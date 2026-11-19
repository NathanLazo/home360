import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  type PrismaClient,
} from "@generated/prisma";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { runSerializable } from "../serializable-tx";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type FinalChargeErrorCode =
  "DIAGNOSTIC_NOT_READY" | "FINAL_CHARGE_EXISTS" | "FINAL_CHARGE_BELOW_CREDIT";

export type IssueFinalChargeResult = {
  orderId: string;
  folio: number;
  /** What the customer pays now (final job − credited diagnostic). */
  amountCents: number;
  creditCents: number;
};

/**
 * The diagnostic visit happened: the technician started it (IN_PROGRESS) or
 * the customer already confirmed it (COMPLETED). Before that the business has
 * nothing to price; DISPUTED / CANCELLED diagnostics never lead to a charge.
 */
const DIAGNOSED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.IN_PROGRESS,
  OrderStatus.COMPLETED,
];

/** A cancelled (e.g. expired unpaid) final charge can be issued again. */
const ACTIVE_FOLLOW_UP_WHERE = { status: { not: OrderStatus.CANCELLED } };

/** Pure rule shared by the service and `order.getById.actions`. */
export function canIssueFinalCharge(input: {
  isDiagnostic: boolean;
  status: OrderStatus;
  hasDispute: boolean;
  hasActiveFollowUp: boolean;
}): boolean {
  return (
    input.isDiagnostic &&
    DIAGNOSED_ORDER_STATUSES.includes(input.status) &&
    !input.hasDispute &&
    !input.hasActiveFollowUp
  );
}

/** Credit applied to a final job price, per the quote's diagnostic terms. */
export function diagnosticCreditFor(input: {
  credited: boolean;
  diagnosticCents: number;
}): number {
  return input.credited ? input.diagnosticCents : 0;
}

/**
 * Issues the final charge of a diagnostic-first service: creates a PENDING
 * SERVICE order (same customer, branch, worker and corporate context) for
 * `finalAmountCents` minus the paid diagnostic when the quote credited it.
 * The customer pays it through the regular checkout (escrow) and the order
 * runs the normal work → evidence → release lifecycle.
 */
export async function issueFinalCharge(
  db: PrismaClient,
  input: {
    businessId: string;
    actorUserId: string;
    diagnosticOrderId: string;
    finalAmountCents: number;
  },
): Promise<ServiceResult<IssueFinalChargeResult, FinalChargeErrorCode>> {
  const issued = await runSerializable<
    ServiceResult<
      IssueFinalChargeResult & { customerId: string },
      FinalChargeErrorCode
    >
  >(
    db,
    async (tx) => {
      const diagnostic = await tx.order.findFirst({
        where: {
          id: input.diagnosticOrderId,
          businessId: input.businessId,
          type: OrderType.SERVICE,
        },
        select: {
          id: true,
          title: true,
          status: true,
          isDiagnostic: true,
          amountCents: true,
          customerId: true,
          branchId: true,
          workerId: true,
          serviceId: true,
          corporateAccountId: true,
          corporateLocationId: true,
          quote: { select: { diagnosticCredited: true } },
          dispute: { select: { id: true } },
          _count: {
            select: { followUpOrders: { where: ACTIVE_FOLLOW_UP_WHERE } },
          },
        },
      });

      if (!diagnostic) {
        return svcFail("NOT_FOUND", "Order not found");
      }

      const hasActiveFollowUp = diagnostic._count.followUpOrders > 0;

      if (hasActiveFollowUp) {
        return svcFail("FINAL_CHARGE_EXISTS", "Final charge already issued");
      }

      if (
        !canIssueFinalCharge({
          isDiagnostic: diagnostic.isDiagnostic,
          status: diagnostic.status,
          hasDispute: diagnostic.dispute !== null,
          hasActiveFollowUp,
        })
      ) {
        return svcFail("DIAGNOSTIC_NOT_READY", "Diagnostic is not done");
      }

      const creditCents = diagnosticCreditFor({
        credited: diagnostic.quote?.diagnosticCredited ?? false,
        diagnosticCents: diagnostic.amountCents,
      });
      const amountCents = input.finalAmountCents - creditCents;

      if (amountCents <= 0) {
        return svcFail(
          "FINAL_CHARGE_BELOW_CREDIT",
          "Final amount must exceed the credited diagnostic",
        );
      }

      const order = await tx.order.create({
        data: {
          type: OrderType.SERVICE,
          title: diagnostic.title,
          status: OrderStatus.PENDING,
          amountCents,
          customerId: diagnostic.customerId,
          businessId: input.businessId,
          branchId: diagnostic.branchId,
          workerId: diagnostic.workerId,
          serviceId: diagnostic.serviceId,
          corporateAccountId: diagnostic.corporateAccountId,
          corporateLocationId: diagnostic.corporateLocationId,
          diagnosticOrderId: diagnostic.id,
          diagnosticCreditCents: creditCents,
          quantity: 1,
        },
        select: { id: true, folio: true },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.ACCEPTED,
          actorUserId: input.actorUserId,
        },
      });

      return svcOk({
        orderId: order.id,
        folio: order.folio,
        amountCents,
        creditCents,
        customerId: diagnostic.customerId,
      });
    },
    () => svcFail("CONFLICT", "Final charge changed concurrently"),
  );

  if (!issued.ok) {
    return issued;
  }

  const { customerId, ...result } = issued.data;

  await sendLocalizedPushToUser(db, customerId, {
    message: "finalChargeIssued",
    url: `home360app://orders/${result.orderId}`,
  });

  return svcOk(result);
}
