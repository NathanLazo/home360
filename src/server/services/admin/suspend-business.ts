import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  type PrismaClient,
} from "../../../../generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type SuspendBusinessDeps = {
  db: PrismaClient;
};

/**
 * Suspension is deliberately not blocked by an open dispute: an open dispute
 * is one of the reasons to suspend. The conditional update also makes a double
 * click idempotent instead of overwriting a previous reason.
 */
export async function suspendBusiness(
  deps: SuspendBusinessDeps,
  input: { businessId: string; reason: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const applied = await deps.db.$transaction(async (tx) => {
    const suspended = await tx.business.updateMany({
      where: { id: input.businessId, status: BusinessStatus.ACTIVE },
      data: { status: BusinessStatus.SUSPENDED, statusReason: input.reason },
    });

    if (suspended.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.BUSINESS_SUSPENDED,
      businessId: input.businessId,
      before: { status: BusinessStatus.ACTIVE },
      after: { status: BusinessStatus.SUSPENDED },
      metadata: { reasonPresent: true },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Business is not active");
  }

  return svcOk({ id: input.businessId });
}
