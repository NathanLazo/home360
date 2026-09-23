import "server-only";

import {
  AdminAuditAction,
  type PrismaClient,
  UserRole,
} from "@generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import type { StartImpersonationInput } from "~/schemas/admin/impersonation.schema";

export type ImpersonationDeps = {
  db: PrismaClient;
};

/** Hard cap of one impersonation; after it the session falls back to ADMIN. */
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

type PanelPath = "/dashboard" | "/corporate";
type AdminReturnPath = "/admin/users" | "/admin/corporate";

function activeSessionsWhere(userId: string, now: Date) {
  return { userId, revokedAt: null, expires: { gt: now } };
}

async function resolveOwner(
  db: PrismaClient,
  input: StartImpersonationInput,
): Promise<{ userId: string; role: UserRole; panel: PanelPath } | null> {
  if (input.subject === "BUSINESS") {
    const business = await db.business.findUnique({
      where: { id: input.subjectId },
      select: { owner: { select: { id: true, role: true } } },
    });

    return business?.owner.role === UserRole.BUSINESS
      ? {
          userId: business.owner.id,
          role: UserRole.BUSINESS,
          panel: "/dashboard",
        }
      : null;
  }

  const account = await db.corporateAccount.findUnique({
    where: { id: input.subjectId },
    select: { owner: { select: { id: true, role: true } } },
  });

  return account?.owner.role === UserRole.CORPORATE
    ? {
        userId: account.owner.id,
        role: UserRole.CORPORATE,
        panel: "/corporate",
      }
    : null;
}

/**
 * Points the admin's live web session at the tenant owner. The single active
 * web session invariant means the admin has exactly one live `Session` row:
 * the one issuing this request. `verifyWebSession` then resolves every
 * `auth()` to the owner (read-only, enforced in `protectedProcedure`) until
 * the admin exits or the TTL runs out. Audited in the same transaction.
 */
export async function startImpersonation(
  deps: ImpersonationDeps,
  input: StartImpersonationInput & { adminId: string },
): Promise<ServiceResult<{ panel: PanelPath }>> {
  const owner = await resolveOwner(deps.db, input);

  if (!owner) {
    return svcFail("NOT_FOUND", "Impersonation subject not found");
  }

  const now = new Date();
  const updated = await deps.db.$transaction(async (tx) => {
    const sessions = await tx.session.updateMany({
      where: activeSessionsWhere(input.adminId, now),
      data: {
        impersonatedUserId: owner.userId,
        impersonationExpiresAt: new Date(now.getTime() + IMPERSONATION_TTL_MS),
      },
    });

    if (sessions.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.IMPERSONATION_STARTED,
      userId: owner.userId,
      metadata: { role: owner.role },
    });

    return true;
  });

  if (!updated) {
    return svcFail("CONFLICT", "No live web session to impersonate from");
  }

  return svcOk({ panel: owner.panel });
}

/**
 * Ends the impersonation of the admin's live session and tells the client
 * where to land back in the admin panel.
 */
export async function stopImpersonation(
  deps: ImpersonationDeps,
  input: { adminId: string },
): Promise<ServiceResult<{ returnTo: AdminReturnPath }>> {
  const now = new Date();
  const outcome = await deps.db.$transaction(async (tx) => {
    const session = await tx.session.findFirst({
      where: {
        ...activeSessionsWhere(input.adminId, now),
        impersonatedUserId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { impersonatedUser: { select: { id: true, role: true } } },
    });
    const target = session?.impersonatedUser;

    if (!target) {
      return null;
    }

    await tx.session.updateMany({
      where: {
        ...activeSessionsWhere(input.adminId, now),
        impersonatedUserId: { not: null },
      },
      data: { impersonatedUserId: null, impersonationExpiresAt: null },
    });

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.IMPERSONATION_ENDED,
      userId: target.id,
      metadata: { role: target.role },
    });

    return target.role;
  });

  if (outcome === null) {
    return svcFail("CONFLICT", "No active impersonation");
  }

  return svcOk({
    returnTo:
      outcome === UserRole.CORPORATE ? "/admin/corporate" : "/admin/users",
  });
}
