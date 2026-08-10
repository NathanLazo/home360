import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  DisputeStatus,
  Prisma,
  type PrismaClient,
} from "../../../../generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ReactivateBusinessDeps = {
  db: PrismaClient;
};

const SERIALIZATION_RETRIES = 3;

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Reactivation must observe the dispute guard and the status flip as one
 * atomic fact: at a lower isolation level a dispute opened concurrently could
 * end up alongside a confirmed reactivation. A bounded retry absorbs the
 * serialization failures that isolation level produces.
 */
export async function reactivateBusiness(
  deps: ReactivateBusinessDeps,
  input: { businessId: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  for (let attempt = 0; attempt < SERIALIZATION_RETRIES; attempt += 1) {
    try {
      const outcome = await deps.db.$transaction(
        async (tx) => {
          const openDisputes = await tx.dispute.count({
            where: {
              businessId: input.businessId,
              status: { not: DisputeStatus.RESOLVED },
            },
          });

          if (openDisputes > 0) {
            return { reactivated: false } as const;
          }

          const reactivated = await tx.business.updateMany({
            where: { id: input.businessId, status: BusinessStatus.SUSPENDED },
            data: { status: BusinessStatus.ACTIVE, statusReason: null },
          });

          if (reactivated.count === 0) {
            return { reactivated: false } as const;
          }

          await writeAdminAudit(tx, input.adminId, {
            action: AdminAuditAction.BUSINESS_REACTIVATED,
            businessId: input.businessId,
            before: { status: BusinessStatus.SUSPENDED },
            after: { status: BusinessStatus.ACTIVE },
          });

          return { reactivated: true } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return outcome.reactivated
        ? svcOk({ id: input.businessId })
        : svcFail("CONFLICT", "Business cannot be reactivated");
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }
    }
  }

  return svcFail("CONFLICT", "Reactivation could not be serialized");
}
