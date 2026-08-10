import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  type PrismaClient,
} from "../../../../generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type RejectBusinessDeps = {
  db: PrismaClient;
};

/**
 * Rejection is purely local: no Subscription, no Stripe object, and the reason
 * is persisted so the detail sheet can explain the decision. The audit entry
 * only records that a reason existed, never its text.
 */
export async function rejectBusiness(
  deps: RejectBusinessDeps,
  input: { businessId: string; reason: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const applied = await deps.db.$transaction(async (tx) => {
    const rejected = await tx.business.updateMany({
      where: { id: input.businessId, status: BusinessStatus.PENDING },
      data: { status: BusinessStatus.REJECTED, statusReason: input.reason },
    });

    if (rejected.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.BUSINESS_REJECTED,
      businessId: input.businessId,
      before: { status: BusinessStatus.PENDING },
      after: { status: BusinessStatus.REJECTED },
      metadata: { reasonPresent: true },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Business is not pending approval");
  }

  return svcOk({ id: input.businessId });
}
