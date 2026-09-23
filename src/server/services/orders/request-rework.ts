import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "@generated/prisma";
import { isAwaitingConfirmation } from "~/server/services/orders/work-cycle";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Customer asks for a fix instead of confirming (workstream D). Only a
 * SERVICE order whose current work cycle ended in WORK_DONE /
 * CONFIRMATION_REQUESTED, with the escrow still held and no dispute,
 * qualifies. The order stays IN_PROGRESS and a REWORK_REQUESTED event (with
 * the customer's note) opens a new work cycle for the technician. The
 * auto-release is paused (`escrowReleaseAt = null`) until the worker finishes
 * again, so the money cannot leave while the fix is pending.
 */
export async function requestOrderRework(
  db: PrismaClient,
  input: { customerId: string; orderId: string; note: string },
): Promise<ServiceResult<{ orderId: string }>> {
  try {
    const reworked = await db.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: input.orderId,
            customerId: input.customerId,
            type: OrderType.SERVICE,
          },
          select: {
            id: true,
            status: true,
            business: { select: { ownerId: true } },
            worker: { select: { userId: true } },
            payment: { select: { id: true, status: true } },
            dispute: { select: { id: true } },
            events: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { type: true },
            },
          },
        });

        if (!order) {
          return svcFail("NOT_FOUND", "Order not found");
        }

        if (
          order.status !== OrderStatus.IN_PROGRESS ||
          order.dispute !== null ||
          order.payment?.status !== PaymentStatus.IN_ESCROW ||
          !isAwaitingConfirmation(order.events)
        ) {
          return svcFail("CONFLICT", "Order is not awaiting confirmation");
        }

        const paused = await tx.payment.updateMany({
          where: { id: order.payment.id, status: PaymentStatus.IN_ESCROW },
          data: { escrowReleaseAt: null },
        });

        if (paused.count === 0) {
          return svcFail("CONFLICT", "Order escrow is no longer held");
        }

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.REWORK_REQUESTED,
            actorUserId: input.customerId,
            note: input.note,
          },
        });

        return svcOk({
          orderId: order.id,
          notify: [order.business.ownerId, order.worker?.userId ?? null],
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!reworked.ok) {
      return reworked;
    }

    for (const userId of reworked.data.notify) {
      if (userId) {
        await sendLocalizedPushToUser(db, userId, {
          message: "reworkRequested",
          url: `home360app://orders/${reworked.data.orderId}`,
        });
      }
    }

    return svcOk({ orderId: reworked.data.orderId });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Rework request conflicted");
    }

    throw error;
  }
}
