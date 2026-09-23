import "server-only";

import {
  AdminAuditAction,
  type PrismaClient,
  UserRole,
} from "@generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type UserModerationDeps = {
  db: PrismaClient;
};

/**
 * Only consumer-side accounts are moderated here: a BUSINESS owner is
 * moderated through its business (W10 businesses tab), and ADMIN/CORPORATE
 * accounts have their own flows.
 */
const MODERATED_ROLES = [UserRole.CUSTOMER, UserRole.WORKER] as const;

/**
 * Suspension blocks every sign-in path (credentials, Google, mobile) and
 * bumps `sessionsValidFrom` in the same write, so every live web session and
 * mobile token is revoked at its next resolution. The conditional update
 * keeps a double click from overwriting the first reason.
 */
export async function suspendUser(
  deps: UserModerationDeps,
  input: { userId: string; reason: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const outcome = await deps.db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return { kind: "not_found" } as const;
    }

    const now = new Date();
    const suspended = await tx.user.updateMany({
      where: {
        id: user.id,
        role: { in: [...MODERATED_ROLES] },
        suspendedAt: null,
      },
      data: {
        suspendedAt: now,
        suspensionReason: input.reason,
        sessionsValidFrom: now,
      },
    });

    if (suspended.count === 0) {
      return { kind: "conflict" } as const;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.USER_SUSPENDED,
      userId: user.id,
      before: { suspended: false },
      after: { suspended: true },
      metadata: { role: user.role, reasonPresent: true },
    });

    return { kind: "ok" } as const;
  });

  if (outcome.kind === "not_found") {
    return svcFail("NOT_FOUND", "User not found");
  }

  if (outcome.kind === "conflict") {
    return svcFail("CONFLICT", "User cannot be suspended");
  }

  return svcOk({ id: input.userId });
}

/**
 * Reactivation only lifts the block: revoked sessions stay revoked and the
 * user simply signs in again.
 */
export async function reactivateUser(
  deps: UserModerationDeps,
  input: { userId: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const outcome = await deps.db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return { kind: "not_found" } as const;
    }

    const reactivated = await tx.user.updateMany({
      where: {
        id: user.id,
        role: { in: [...MODERATED_ROLES] },
        suspendedAt: { not: null },
      },
      data: { suspendedAt: null, suspensionReason: null },
    });

    if (reactivated.count === 0) {
      return { kind: "conflict" } as const;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.USER_REACTIVATED,
      userId: user.id,
      before: { suspended: true },
      after: { suspended: false },
      metadata: { role: user.role, reasonPresent: false },
    });

    return { kind: "ok" } as const;
  });

  if (outcome.kind === "not_found") {
    return svcFail("NOT_FOUND", "User not found");
  }

  if (outcome.kind === "conflict") {
    return svcFail("CONFLICT", "User is not suspended");
  }

  return svcOk({ id: input.userId });
}
