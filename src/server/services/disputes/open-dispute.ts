import "server-only";

import {
  DisputeStatus,
  DisputeUrgency,
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "@generated/prisma";
import type { DisputeReason } from "~/schemas/disputes/dispute-reasons";
import { isOwnedMediaPathname } from "~/server/services/media/blob";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export {
  DISPUTE_REASONS,
  type DisputeReason,
} from "~/schemas/disputes/dispute-reasons";

/** Reasons that imply harm or a missed visit always jump the admin queue. */
const URGENT_REASONS: readonly DisputeReason[] = ["DAMAGE", "NO_SHOW"];

/** 5,000 MXN: high-value escrows are reviewed first. */
const URGENT_AMOUNT_CENTS = 500_000;

const DISPUTABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SHIPPING,
];

const DISPUTE_TITLE_MAX_LENGTH = 120;

export type OpenDisputeInput = {
  customerId: string;
  orderId: string;
  reason: DisputeReason;
  description: string;
  evidencePathnames: string[];
};

export type OpenDisputeResult = {
  disputeId: string;
  orderId: string;
  urgency: DisputeUrgency;
};

type OpenDisputeError = "VALIDATION_ERROR" | "DISPUTE_OPEN";

/**
 * Urgency heuristic: harm/no-show reasons, a missing or incomplete recording
 * (D6 — the platform cannot verify the work) or a high-value escrow make the
 * dispute URGENT; everything else is NORMAL.
 */
export function disputeUrgency(input: {
  reason: DisputeReason;
  recordingComplete: boolean;
  workStarted: boolean;
  amountCents: number;
}): DisputeUrgency {
  if (
    URGENT_REASONS.includes(input.reason) ||
    (input.workStarted && !input.recordingComplete) ||
    input.amountCents >= URGENT_AMOUNT_CENTS
  ) {
    return DisputeUrgency.URGENT;
  }

  return DisputeUrgency.NORMAL;
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Customer-side dispute (workstream D). Allowed only while the money is still
 * held: payment `IN_ESCROW` and order not closed. Per PENDIENTES "Contrato
 * operativo de liberación" the dispute is created in a serializable
 * transaction that also writes the still-`IN_ESCROW` Payment, so it competes
 * atomically with the release CAS (a RELEASING payment can no longer be
 * disputed). The open dispute is what blocks manual and automatic release.
 */
export async function openCustomerDispute(
  db: PrismaClient,
  input: OpenDisputeInput,
): Promise<ServiceResult<OpenDisputeResult, OpenDisputeError>> {
  if (
    input.evidencePathnames.some(
      (pathname) =>
        !isOwnedMediaPathname(pathname, input.customerId, [
          "evidence",
          "requestPhoto",
          "requestVideo",
        ]),
    )
  ) {
    return svcFail("VALIDATION_ERROR", "Invalid evidence pathname");
  }

  try {
    const opened = await db.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: input.orderId, customerId: input.customerId },
          select: {
            id: true,
            title: true,
            status: true,
            businessId: true,
            amountCents: true,
            recordingComplete: true,
            business: { select: { ownerId: true } },
            payment: { select: { id: true, status: true } },
            dispute: { select: { id: true } },
            events: { select: { type: true } },
          },
        });

        if (!order) {
          return svcFail("NOT_FOUND", "Order not found");
        }

        if (order.dispute) {
          return svcFail("DISPUTE_OPEN", "Order already has a dispute");
        }

        if (
          !DISPUTABLE_ORDER_STATUSES.includes(order.status) ||
          order.payment?.status !== PaymentStatus.IN_ESCROW
        ) {
          return svcFail("CONFLICT", "Order escrow is no longer held");
        }

        // CAS on the escrowed payment: a concurrent release that already
        // claimed it (RELEASING) makes this write miss and the dispute fail.
        const held = await tx.payment.updateMany({
          where: { id: order.payment.id, status: PaymentStatus.IN_ESCROW },
          data: { updatedAt: new Date() },
        });

        if (held.count === 0) {
          return svcFail("CONFLICT", "Order escrow is no longer held");
        }

        const urgency = disputeUrgency({
          reason: input.reason,
          recordingComplete: order.recordingComplete,
          workStarted: order.events.some(
            (event) => event.type === OrderEventType.RECORDING_STARTED,
          ),
          amountCents: order.amountCents,
        });
        const dispute = await tx.dispute.create({
          data: {
            orderId: order.id,
            businessId: order.businessId,
            title: order.title.slice(0, DISPUTE_TITLE_MAX_LENGTH),
            urgency,
            status: DisputeStatus.OPEN,
            customerArgument: input.description,
            evidenceUrls: input.evidencePathnames,
          },
          select: { id: true },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.DISPUTED },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.DISPUTE_OPENED,
            actorUserId: input.customerId,
            note: input.reason,
          },
        });

        return svcOk({
          disputeId: dispute.id,
          orderId: order.id,
          urgency,
          businessOwnerId: order.business.ownerId,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!opened.ok) {
      return opened;
    }

    await sendLocalizedPushToUser(db, opened.data.businessOwnerId, {
      message: "disputeOpened",
      url: `home360app://orders/${opened.data.orderId}`,
    });

    return svcOk({
      disputeId: opened.data.disputeId,
      orderId: opened.data.orderId,
      urgency: opened.data.urgency,
    });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Dispute opening conflicted");
    }

    throw error;
  }
}
