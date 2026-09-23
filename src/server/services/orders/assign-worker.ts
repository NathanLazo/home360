import "server-only";

import {
  InvitationStatus,
  OrderEventType,
  OrderStatus,
  OrderType,
  type PrismaClient,
} from "@generated/prisma";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type AssignWorkerResult = {
  orderId: string;
  workerId: string;
};

/** Service orders still open to (re)assignment. */
const ASSIGNABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
];

/**
 * Business assigns or reassigns the technician of a SERVICE order that is not
 * finished (MA-01). The worker must belong to the business and have accepted
 * the invitation (same tenancy rule as quote.submit). Writes a
 * `WORKER_ASSIGNED` OrderEvent and pushes the worker when they have an app
 * account. Assigning the already-assigned worker is an idempotent no-op.
 */
export async function assignOrderWorker(
  db: PrismaClient,
  input: {
    businessId: string;
    actorUserId: string;
    orderId: string;
    workerId: string;
  },
): Promise<ServiceResult<AssignWorkerResult, "VALIDATION_ERROR">> {
  const order = await db.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId },
    select: { id: true, type: true, status: true, workerId: true },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.type !== OrderType.SERVICE) {
    return svcFail("VALIDATION_ERROR", "Only service orders take a worker");
  }

  if (!ASSIGNABLE_STATUSES.includes(order.status)) {
    return svcFail("CONFLICT", "Order is no longer assignable");
  }

  const worker = await db.worker.findFirst({
    where: { id: input.workerId },
    select: {
      id: true,
      businessId: true,
      userId: true,
      invitationStatus: true,
    },
  });

  if (!worker) {
    return svcFail("NOT_FOUND", "Worker not found");
  }

  if (
    worker.businessId !== input.businessId ||
    worker.invitationStatus !== InvitationStatus.ACCEPTED
  ) {
    return svcFail("VALIDATION_ERROR", "Worker does not belong to business");
  }

  if (order.workerId === worker.id) {
    return svcOk({ orderId: order.id, workerId: worker.id });
  }

  const updated = await db.order.updateMany({
    where: {
      id: order.id,
      businessId: input.businessId,
      status: { in: ASSIGNABLE_STATUSES },
    },
    data: { workerId: worker.id },
  });

  if (updated.count === 0) {
    return svcFail("CONFLICT", "Order is no longer assignable");
  }

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: OrderEventType.WORKER_ASSIGNED,
      actorUserId: input.actorUserId,
    },
  });

  if (worker.userId) {
    await sendLocalizedPushToUser(db, worker.userId, {
      message: "orderWorkerAssigned",
      url: `home360app://orders/${order.id}`,
    });
  }

  return svcOk({ orderId: order.id, workerId: worker.id });
}
