import "server-only";

import {
  FulfillmentMethod,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import type Stripe from "stripe";

import {
  releaseRateLimitAttempts,
  reserveRateLimitAttempts,
} from "~/server/services/auth/rate-limit";
import { isOwnedMediaPathname } from "~/server/services/media/blob";
import {
  derivePickupCode,
  hashPickupCode,
  isPickupCodeConfigured,
} from "~/server/services/orders/pickup-code";
import { effectiveFulfillmentMethod } from "~/server/services/orders/order-actions";
import { armAutoRelease } from "~/server/services/payments/auto-release";
import { releasePayment } from "~/server/services/payments/escrow";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { runSerializable } from "~/server/services/serializable-tx";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** D10-2 pickup brute-force guard: failed redemptions per business. */
const PICKUP_REDEEM_MAX_FAILURES = 10;
const PICKUP_REDEEM_WINDOW_MINUTES = 10;

export type FulfillmentErrorCode =
  "FULFILLMENT_MISMATCH" | "VALIDATION_ERROR" | "PICKUP_NOT_CONFIGURED";

export type RedeemPickupErrorCode = "PICKUP_CODE_INVALID" | "TOO_MANY_REQUESTS";

export type FulfillmentStepResult = {
  orderId: string;
  status: OrderStatus;
  event: OrderEventType;
};

export type MarkDeliveredResult = FulfillmentStepResult & {
  /** Auto-release deadline armed by CONFIRMATION_REQUESTED (D10-3). */
  escrowReleaseAt: Date;
};

export type RedeemPickupResult = {
  orderId: string;
  folio: number;
  title: string;
  quantity: number;
  pickedUpAt: Date;
  /** `true` when the escrow was released and the order is COMPLETED. */
  released: boolean;
  status: OrderStatus;
};

type BusinessActor = { businessId: string; actorUserId: string };

const fulfillmentOrderSelect = {
  id: true,
  type: true,
  status: true,
  fulfillmentMethod: true,
  customerId: true,
  pickedUpAt: true,
  payment: { select: { id: true, status: true } },
  dispute: { select: { id: true } },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { type: true },
  },
} satisfies Prisma.OrderSelect;

type FulfillmentOrder = Prisma.OrderGetPayload<{
  select: typeof fulfillmentOrderSelect;
}>;

function hasEvent(order: FulfillmentOrder, type: OrderEventType): boolean {
  return order.events.some((event) => event.type === type);
}

/**
 * Loads the business's own order inside the transaction and checks it is a
 * PRODUCT with the expected fulfillment method in SHIPPING (accepted).
 */
async function loadShippingOrder(
  tx: Prisma.TransactionClient,
  input: { businessId: string; orderId: string; method: FulfillmentMethod },
): Promise<ServiceResult<FulfillmentOrder, "FULFILLMENT_MISMATCH">> {
  const order = await tx.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId },
    select: fulfillmentOrderSelect,
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (
    order.type !== OrderType.PRODUCT ||
    effectiveFulfillmentMethod(order.type, order.fulfillmentMethod) !==
      input.method
  ) {
    return svcFail("FULFILLMENT_MISMATCH", "Order fulfillment does not match");
  }

  if (order.status !== OrderStatus.SHIPPING) {
    return svcFail("CONFLICT", "Order is not in fulfillment");
  }

  return svcOk(order);
}

const conflictExhausted = () =>
  svcFail("CONFLICT", "Order changed concurrently");

/**
 * DELIVERY, optional step: the package left the branch (OUT_FOR_DELIVERY).
 * Only once and before DELIVERED. Pushes `orderOutForDelivery`.
 */
export async function markOutForDelivery(
  db: PrismaClient,
  input: BusinessActor & { orderId: string },
): Promise<ServiceResult<FulfillmentStepResult, FulfillmentErrorCode>> {
  const result = await runSerializable<
    ServiceResult<{ customerId: string }, FulfillmentErrorCode>
  >(
    db,
    async (tx) => {
      const loaded = await loadShippingOrder(tx, {
        businessId: input.businessId,
        orderId: input.orderId,
        method: FulfillmentMethod.DELIVERY,
      });

      if (!loaded.ok) {
        return loaded;
      }

      const order = loaded.data;

      if (
        hasEvent(order, OrderEventType.OUT_FOR_DELIVERY) ||
        hasEvent(order, OrderEventType.DELIVERED)
      ) {
        return svcFail("CONFLICT", "Order is already on its way");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.OUT_FOR_DELIVERY,
          actorUserId: input.actorUserId,
        },
      });

      return svcOk({ customerId: order.customerId });
    },
    conflictExhausted,
  );

  if (!result.ok) {
    return result;
  }

  await sendLocalizedPushToUser(db, result.data.customerId, {
    message: "orderOutForDelivery",
    url: `home360app://orders/${input.orderId}`,
  });

  return svcOk({
    orderId: input.orderId,
    status: OrderStatus.SHIPPING,
    event: OrderEventType.OUT_FOR_DELIVERY,
  });
}

/**
 * DELIVERY: the business leaves the package at the address and proves it
 * with 1–10 photos (kind `evidence`, uploaded by the business owner). Writes
 * `deliveryEvidenceUrls` + `deliveryNote`, the DELIVERED and
 * CONFIRMATION_REQUESTED events, and arms the auto-release clock (D10-2 /
 * D10-3). The order stays SHIPPING until the customer confirms or the clock
 * releases it (→ COMPLETED).
 */
export async function markDelivered(
  db: PrismaClient,
  input: BusinessActor & {
    orderId: string;
    evidencePathnames: string[];
    note?: string;
  },
): Promise<ServiceResult<MarkDeliveredResult, FulfillmentErrorCode>> {
  if (
    input.evidencePathnames.length === 0 ||
    input.evidencePathnames.some(
      (pathname) =>
        !isOwnedMediaPathname(pathname, input.actorUserId, ["evidence"]),
    )
  ) {
    return svcFail("VALIDATION_ERROR", "Invalid delivery evidence pathname");
  }

  const result = await runSerializable<
    ServiceResult<
      { customerId: string; escrowReleaseAt: Date },
      FulfillmentErrorCode
    >
  >(
    db,
    async (tx) => {
      const loaded = await loadShippingOrder(tx, {
        businessId: input.businessId,
        orderId: input.orderId,
        method: FulfillmentMethod.DELIVERY,
      });

      if (!loaded.ok) {
        return loaded;
      }

      const order = loaded.data;

      if (hasEvent(order, OrderEventType.DELIVERED)) {
        return svcFail("CONFLICT", "Order was already delivered");
      }

      if (
        order.dispute !== null ||
        order.payment?.status !== PaymentStatus.IN_ESCROW
      ) {
        return svcFail("CONFLICT", "Order escrow is no longer held");
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryEvidenceUrls: input.evidencePathnames,
          deliveryNote: input.note ?? null,
        },
      });
      await tx.orderEvent.createMany({
        data: [
          {
            orderId: order.id,
            type: OrderEventType.DELIVERED,
            actorUserId: input.actorUserId,
            note: input.note ?? null,
          },
          {
            orderId: order.id,
            type: OrderEventType.CONFIRMATION_REQUESTED,
            actorUserId: input.actorUserId,
          },
        ],
      });

      const escrowReleaseAt = await armAutoRelease(tx, {
        paymentId: order.payment.id,
      });

      return svcOk({ customerId: order.customerId, escrowReleaseAt });
    },
    conflictExhausted,
  );

  if (!result.ok) {
    return result;
  }

  await sendLocalizedPushToUser(db, result.data.customerId, {
    message: "orderDelivered",
    url: `home360app://orders/${input.orderId}`,
  });

  return svcOk({
    orderId: input.orderId,
    status: OrderStatus.SHIPPING,
    event: OrderEventType.DELIVERED,
    escrowReleaseAt: result.data.escrowReleaseAt,
  });
}

/**
 * PICKUP: the order waits at the branch. Stores the SHA-256 of the order's
 * derived pickup code (the plaintext is only ever rendered to the customer by
 * `tracking.getOrder`) and writes READY_FOR_PICKUP. Pushes
 * `orderReadyForPickup`. Needs `PICKUP_CODE_SECRET`.
 */
export async function markReadyForPickup(
  db: PrismaClient,
  input: BusinessActor & { orderId: string },
): Promise<ServiceResult<FulfillmentStepResult, FulfillmentErrorCode>> {
  const code = isPickupCodeConfigured()
    ? derivePickupCode(input.orderId)
    : null;

  if (code === null) {
    return svcFail("PICKUP_NOT_CONFIGURED", "Pickup codes are not configured");
  }

  const pickupCodeHash = hashPickupCode(code);
  const result = await runSerializable<
    ServiceResult<{ customerId: string }, FulfillmentErrorCode>
  >(
    db,
    async (tx) => {
      const loaded = await loadShippingOrder(tx, {
        businessId: input.businessId,
        orderId: input.orderId,
        method: FulfillmentMethod.PICKUP,
      });

      if (!loaded.ok) {
        return loaded;
      }

      const order = loaded.data;

      if (hasEvent(order, OrderEventType.READY_FOR_PICKUP)) {
        return svcFail("CONFLICT", "Order is already ready for pickup");
      }

      await tx.order.update({
        where: { id: order.id },
        data: { pickupCodeHash },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.READY_FOR_PICKUP,
          actorUserId: input.actorUserId,
        },
      });

      return svcOk({ customerId: order.customerId });
    },
    conflictExhausted,
  );

  if (!result.ok) {
    return result;
  }

  await sendLocalizedPushToUser(db, result.data.customerId, {
    message: "orderReadyForPickup",
    url: `home360app://orders/${input.orderId}`,
  });

  return svcOk({
    orderId: input.orderId,
    status: OrderStatus.SHIPPING,
    event: OrderEventType.READY_FOR_PICKUP,
  });
}

/**
 * PICKUP redemption (D10-2): the business scans the customer's QR. The code
 * is looked up by hash inside the business's own READY_FOR_PICKUP orders; a
 * miss is `PICKUP_CODE_INVALID` and counts against a per-business rate limit.
 * The customer handing over the code is the confirmation, so one short
 * transaction writes PICKED_UP, `pickedUpAt` and makes the escrow due now;
 * then the escrow is released (CONFIRMED) and the order COMPLETED. A failed
 * transfer leaves the payment due, and the cron completes it later.
 */
export async function redeemPickup(
  deps: { db: PrismaClient; resolveStripe: () => Stripe },
  input: BusinessActor & { code: string },
): Promise<
  ServiceResult<
    RedeemPickupResult,
    FulfillmentErrorCode | RedeemPickupErrorCode
  >
> {
  const { db } = deps;
  const reservation = await reserveRateLimitAttempts(db, [
    {
      action: "pickup-redeem",
      identifier: `business:${input.businessId}`,
      max: PICKUP_REDEEM_MAX_FAILURES,
      windowMinutes: PICKUP_REDEEM_WINDOW_MINUTES,
    },
  ]);

  if (!reservation.allowed) {
    return svcFail("TOO_MANY_REQUESTS", "Too many pickup attempts");
  }

  const pickupCodeHash = hashPickupCode(input.code);
  const pickedUpAt = new Date();
  const claimed = await runSerializable<
    ServiceResult<
      {
        orderId: string;
        folio: number;
        title: string;
        quantity: number;
        paymentId: string;
      },
      FulfillmentErrorCode | RedeemPickupErrorCode
    >
  >(
    db,
    async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          pickupCodeHash,
          businessId: input.businessId,
          type: OrderType.PRODUCT,
          fulfillmentMethod: FulfillmentMethod.PICKUP,
        },
        select: {
          id: true,
          folio: true,
          title: true,
          quantity: true,
          status: true,
          pickedUpAt: true,
          payment: { select: { id: true, status: true } },
          dispute: { select: { id: true } },
        },
      });

      // An already redeemed code is as invalid as an unknown one.
      if (order?.pickedUpAt !== null) {
        return svcFail("PICKUP_CODE_INVALID", "Pickup code not recognized");
      }

      if (
        order.status !== OrderStatus.SHIPPING ||
        order.dispute !== null ||
        order.payment?.status !== PaymentStatus.IN_ESCROW
      ) {
        return svcFail("CONFLICT", "Order cannot be picked up now");
      }

      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.SHIPPING,
          pickedUpAt: null,
        },
        data: { pickedUpAt },
      });

      if (changed.count === 0) {
        return svcFail("CONFLICT", "Order cannot be picked up now");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.PICKED_UP,
          actorUserId: input.actorUserId,
        },
      });
      // Due immediately: if the inline release below fails, the release cron
      // picks the payment up on its next run.
      await tx.payment.updateMany({
        where: { id: order.payment.id, status: PaymentStatus.IN_ESCROW },
        data: { escrowReleaseAt: pickedUpAt },
      });

      return svcOk({
        orderId: order.id,
        folio: order.folio,
        title: order.title,
        quantity: order.quantity,
        paymentId: order.payment.id,
      });
    },
    conflictExhausted,
  );

  if (!claimed.ok) {
    return claimed;
  }

  // Only failed redemptions count against the limit.
  await releaseRateLimitAttempts(db, reservation.attemptIds);

  let released = false;

  try {
    const release = await releasePayment(
      { db, stripe: deps.resolveStripe() },
      {
        paymentId: claimed.data.paymentId,
        event: {
          type: OrderEventType.CONFIRMED,
          actorUserId: input.actorUserId,
        },
      },
    );

    released = release.ok;

    if (!release.ok) {
      console.error("[order.redeemPickup] PICKUP_RELEASE_DEFERRED", {
        orderId: claimed.data.orderId,
        code: release.code,
      });
    }
  } catch {
    console.error("[order.redeemPickup] PICKUP_RELEASE_DEFERRED", {
      orderId: claimed.data.orderId,
      code: "UNEXPECTED_ERROR",
    });
  }

  const current = await db.order.findUnique({
    where: { id: claimed.data.orderId },
    select: { status: true },
  });

  return svcOk({
    orderId: claimed.data.orderId,
    folio: claimed.data.folio,
    title: claimed.data.title,
    quantity: claimed.data.quantity,
    pickedUpAt,
    released,
    status: current?.status ?? OrderStatus.SHIPPING,
  });
}
