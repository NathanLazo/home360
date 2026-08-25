import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  type PrismaClient,
} from "../../../../generated/prisma";
import { haversineKm } from "~/server/services/geo/haversine";
import { triggerPusherEvent } from "~/server/services/messaging/pusher-server";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PAGE_SIZE = 20;

/** Honest ETA approximation without a routing API (ticket M4-W2). */
const ETA_SPEED_KMH = 25;

/** `updateLocation` writes at most once per window; earlier calls are no-ops. */
const LOCATION_THROTTLE_MS = 15_000;

/**
 * An order is "in live tracking" while the technician announced EN_ROUTE and
 * the customer has not CONFIRMED yet. Outside that window the worker position
 * is never exposed (no history, spec restriction).
 */
const trackableStatuses: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
];

export type TimelineEvent = {
  id: string;
  type: OrderEventType;
  createdAt: Date;
};

export type TrackedWorker = {
  fullName: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  locationUpdatedAt: Date | null;
};

export type OrderTracking = {
  folio: number;
  title: string;
  status: OrderStatus;
  timeline: TimelineEvent[];
  business: { name: string };
  /** Present only while the order is in the live-tracking window (MA-05: no
   * phone exists in the schema; the contact channel is the chat). */
  worker?: TrackedWorker;
  /** Haversine worker→order geo at 25 km/h; omitted without both coordinates. */
  etaMinutes?: number;
};

export type MyOrderListItem = {
  id: string;
  folio: number;
  title: string;
  type: OrderType;
  status: OrderStatus;
  amountCents: number;
  businessName: string;
  createdAt: Date;
};

export type MyOrdersList = {
  items: MyOrderListItem[];
  nextCursor: string | null;
};

export type UpdateLocationResult = {
  updated: boolean;
  notifiedOrders: number;
};

function isLiveTracking(events: { type: OrderEventType }[]): boolean {
  return (
    events.some((event) => event.type === OrderEventType.EN_ROUTE) &&
    !events.some((event) => event.type === OrderEventType.CONFIRMED)
  );
}

/**
 * C6 tracking payload of an own order: timeline asc plus the technician's
 * last known position, exposed only during the live-tracking window. Order
 * geo (MA-06): SERVICE → quote.request coordinates; PRODUCT → the delivery
 * snapshot columns.
 */
export async function getOrderTracking(
  db: PrismaClient,
  input: { customerId: string; orderId: string },
): Promise<ServiceResult<OrderTracking>> {
  const order = await db.order.findFirst({
    where: { id: input.orderId, customerId: input.customerId },
    select: {
      folio: true,
      title: true,
      type: true,
      status: true,
      deliveryLatitude: true,
      deliveryLongitude: true,
      business: { select: { name: true } },
      worker: {
        select: {
          fullName: true,
          lastLatitude: true,
          lastLongitude: true,
          locationUpdatedAt: true,
        },
      },
      quote: {
        select: {
          request: { select: { latitude: true, longitude: true } },
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, type: true, createdAt: true },
      },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  const tracking: OrderTracking = {
    folio: order.folio,
    title: order.title,
    status: order.status,
    timeline: order.events,
    business: { name: order.business.name },
  };

  if (!order.worker || !isLiveTracking(order.events)) {
    return svcOk(tracking);
  }

  tracking.worker = order.worker;

  const orderGeo =
    order.type === OrderType.SERVICE
      ? {
          latitude: order.quote?.request.latitude ?? null,
          longitude: order.quote?.request.longitude ?? null,
        }
      : { latitude: order.deliveryLatitude, longitude: order.deliveryLongitude };

  if (
    order.worker.lastLatitude !== null &&
    order.worker.lastLongitude !== null &&
    orderGeo.latitude !== null &&
    orderGeo.longitude !== null
  ) {
    const distanceKm = haversineKm(
      {
        latitude: order.worker.lastLatitude,
        longitude: order.worker.lastLongitude,
      },
      { latitude: orderGeo.latitude, longitude: orderGeo.longitude },
    );

    tracking.etaMinutes = Math.round((distanceKm / ETA_SPEED_KMH) * 60);
  }

  return svcOk(tracking);
}

/** Cursor pagination over the customer's orders (Órdenes tab, F2-05 pattern). */
export async function listMyOrders(
  db: PrismaClient,
  input: { customerId: string; cursor?: string },
): Promise<ServiceResult<MyOrdersList>> {
  if (input.cursor) {
    const cursorRow = await db.order.findFirst({
      where: { id: input.cursor, customerId: input.customerId },
      select: { id: true },
    });

    if (!cursorRow) {
      return svcFail("NOT_FOUND", "Order cursor not found");
    }
  }

  const rows = await db.order.findMany({
    where: { customerId: input.customerId },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      folio: true,
      title: true,
      type: true,
      status: true,
      amountCents: true,
      createdAt: true,
      business: { select: { name: true } },
    },
  });
  const items = rows.slice(0, PAGE_SIZE);
  const nextCursor =
    rows.length > PAGE_SIZE ? (items.at(-1)?.id ?? null) : null;

  return svcOk({
    items: items.map((row) => ({
      id: row.id,
      folio: row.folio,
      title: row.title,
      type: row.type,
      status: row.status,
      amountCents: row.amountCents,
      businessName: row.business.name,
      createdAt: row.createdAt,
    })),
    nextCursor,
  });
}

/**
 * Persists the technician's position (throttled to one write per 15 s; an
 * early call is an ok no-op so the app never treats it as an error) and
 * notifies `location:update` on `private-order-{id}` of every order in the
 * live-tracking window assigned via `Order.workerId` (MA-01). Payload is
 * minimal and non-sensitive; persistence is the source of truth.
 */
export async function updateWorkerLocation(
  db: PrismaClient,
  input: { workerId: string; latitude: number; longitude: number },
): Promise<ServiceResult<UpdateLocationResult>> {
  const worker = await db.worker.findUnique({
    where: { id: input.workerId },
    select: { locationUpdatedAt: true },
  });

  if (!worker) {
    return svcFail("NOT_FOUND", "Worker not found");
  }

  const now = new Date();

  if (
    worker.locationUpdatedAt !== null &&
    now.getTime() - worker.locationUpdatedAt.getTime() < LOCATION_THROTTLE_MS
  ) {
    return svcOk({ updated: false, notifiedOrders: 0 });
  }

  await db.worker.update({
    where: { id: input.workerId },
    data: {
      lastLatitude: input.latitude,
      lastLongitude: input.longitude,
      locationUpdatedAt: now,
    },
  });

  const activeOrders = await db.order.findMany({
    where: {
      workerId: input.workerId,
      status: { in: trackableStatuses },
      events: { some: { type: OrderEventType.EN_ROUTE } },
      NOT: { events: { some: { type: OrderEventType.CONFIRMED } } },
    },
    select: { id: true },
  });

  await triggerPusherEvent(
    activeOrders.map((order) => `private-order-${order.id}`),
    "location:update",
    {
      latitude: input.latitude,
      longitude: input.longitude,
      updatedAt: now.toISOString(),
    },
  );

  return svcOk({ updated: true, notifiedOrders: activeOrders.length });
}
