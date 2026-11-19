import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  type PrismaClient,
} from "@generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ApproveBusinessErrorCode = "NOT_FOUND" | "CONFLICT";

export type ApproveBusinessDeps = {
  db: PrismaClient;
};

/**
 * Approving a business only moves it PENDING → ACTIVE (atomic, audited).
 *
 * The plan is no longer assigned here (`PENDIENTES.md` §8, revised
 * 2026-11-19): the business picks and pays its own plan through Stripe
 * Checkout, where it can also redeem a promotion code. Until then it has no
 * local Subscription, which `activeBusinessProcedure` treats as read-only, and
 * the dashboard asks it to choose a plan. No Connect account is created either:
 * the business runs its own onboarding (F3).
 */
export async function approveBusiness(
  deps: ApproveBusinessDeps,
  input: { businessId: string; adminId: string },
): Promise<ServiceResult<{ id: string }, ApproveBusinessErrorCode>> {
  const activated = await deps.db.$transaction(async (tx) => {
    // Conditional update: a concurrent approval leaves count 0 instead of
    // approving twice.
    const updated = await tx.business.updateMany({
      where: { id: input.businessId, status: BusinessStatus.PENDING },
      data: { status: BusinessStatus.ACTIVE, statusReason: null },
    });

    if (updated.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.BUSINESS_APPROVED,
      businessId: input.businessId,
      before: { status: BusinessStatus.PENDING },
      after: { status: BusinessStatus.ACTIVE },
    });

    return true;
  });

  if (!activated) {
    const exists = await deps.db.business.findUnique({
      where: { id: input.businessId },
      select: { id: true },
    });

    return exists
      ? svcFail("CONFLICT", "Business is not pending approval")
      : svcFail("NOT_FOUND", "Business not found");
  }

  return svcOk({ id: input.businessId });
}
