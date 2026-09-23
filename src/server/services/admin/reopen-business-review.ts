import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  type PrismaClient,
} from "@generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ReopenBusinessReviewDeps = {
  db: PrismaClient;
};

/**
 * A rejection is purely local (no Subscription, no Stripe object), so sending
 * the business back to the PENDING queue is always safe: approval later runs
 * the full billing flow as for any first-time applicant. The previous reason
 * is cleared because it no longer describes the current state.
 */
export async function reopenBusinessReview(
  deps: ReopenBusinessReviewDeps,
  input: { businessId: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const applied = await deps.db.$transaction(async (tx) => {
    const reopened = await tx.business.updateMany({
      where: { id: input.businessId, status: BusinessStatus.REJECTED },
      data: { status: BusinessStatus.PENDING, statusReason: null },
    });

    if (reopened.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.BUSINESS_REVIEW_REOPENED,
      businessId: input.businessId,
      before: { status: BusinessStatus.REJECTED },
      after: { status: BusinessStatus.PENDING },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Business is not rejected");
  }

  return svcOk({ id: input.businessId });
}
