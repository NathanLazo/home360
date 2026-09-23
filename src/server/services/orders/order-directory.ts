import "server-only";

import type {
  Prisma,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from "@generated/prisma";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { assertBranchInBusiness } from "~/server/services/business/branch-access";
import type { OrderListInput } from "~/server/services/orders/order.schema";
import {
  resolveOrderMediaUrl,
  resolveOrderMediaUrls,
} from "~/server/services/orders/order-media";

const PAGE_SIZE = 20;
const MAX_PRISMA_INT = 2_147_483_647;

const orderListSelect = {
  id: true,
  folio: true,
  title: true,
  type: true,
  amountCents: true,
  status: true,
  createdAt: true,
  customer: { select: { name: true } },
  branch: { select: { name: true } },
  worker: { select: { fullName: true } },
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  id: true,
  folio: true,
  type: true,
  title: true,
  status: true,
  amountCents: true,
  quantity: true,
  recordingUrl: true,
  recordingComplete: true,
  recordingDurationSec: true,
  beforeUrls: true,
  afterUrls: true,
  workNotes: true,
  deliveryAddressLine: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, email: true } },
  branch: { select: { id: true, name: true } },
  worker: { select: { id: true, fullName: true } },
  service: { select: { id: true, name: true, category: true } },
  product: { select: { id: true, name: true, sku: true } },
  quote: {
    select: {
      id: true,
      amountCents: true,
      scheduledFor: true,
      message: true,
      request: { select: { id: true, addressLine: true } },
    },
  },
  payment: {
    select: {
      status: true,
      method: true,
      amountCents: true,
      commissionCents: true,
      escrowReleaseAt: true,
      releasedAt: true,
      createdAt: true,
    },
  },
  review: { select: { rating: true, comment: true } },
  materials: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unitPriceCents: true,
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  events: {
    select: {
      id: true,
      type: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.OrderSelect;

type OrderListPayload = Prisma.OrderGetPayload<{
  select: typeof orderListSelect;
}>;

type OrderDetailPayload = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

export type OrderListItem = {
  id: string;
  folio: number;
  title: string;
  type: OrderType;
  customerName: string | null;
  branchName: string | null;
  workerName: string | null;
  amountCents: number;
  status: OrderStatus;
  createdAt: Date;
};

type OrderListResult = {
  items: OrderListItem[];
  nextCursor: string | null;
};

export type OrderDetail = {
  id: string;
  folio: number;
  type: OrderType;
  title: string;
  status: OrderStatus;
  amountCents: number;
  quantity: number;
  /** Signed, short-lived read URL (MA-02) or `null` when unavailable. */
  recordingUrl: string | null;
  recordingComplete: boolean;
  recordingDurationSec: number | null;
  beforeUrls: string[];
  afterUrls: string[];
  workNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** PRODUCT delivery snapshot or, for SERVICE, the accepted request address. */
  addressLine: string | null;
  customer: { id: string; name: string | null; email: string | null };
  branch: { id: string; name: string } | null;
  worker: { id: string; fullName: string } | null;
  service: { id: string; name: string; category: string } | null;
  product: { id: string; name: string; sku: string } | null;
  quote: {
    id: string;
    requestId: string;
    amountCents: number;
    scheduledFor: Date | null;
    message: string | null;
  } | null;
  payment: {
    status: PaymentStatus;
    method: PaymentMethod;
    amountCents: number;
    commissionCents: number;
    escrowReleaseAt: Date | null;
    releasedAt: Date | null;
    createdAt: Date;
  } | null;
  review: { rating: number; comment: string | null } | null;
  materials: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    product: { id: string; name: string; sku: string } | null;
  }>;
  events: Array<{
    id: string;
    type: OrderEventType;
    note: string | null;
    createdAt: Date;
    actorName: string | null;
  }>;
};

type SignedOrderMedia = {
  recordingUrl: string | null;
  beforeUrls: string[];
  afterUrls: string[];
};

function toOrderListItem(order: OrderListPayload): OrderListItem {
  return {
    id: order.id,
    folio: order.folio,
    title: order.title,
    type: order.type,
    customerName: order.customer.name,
    branchName: order.branch?.name ?? null,
    workerName: order.worker?.fullName ?? null,
    amountCents: order.amountCents,
    status: order.status,
    createdAt: order.createdAt,
  };
}

function toOrderDetail(
  order: OrderDetailPayload,
  media: SignedOrderMedia,
): OrderDetail {
  return {
    id: order.id,
    folio: order.folio,
    type: order.type,
    title: order.title,
    status: order.status,
    amountCents: order.amountCents,
    quantity: order.quantity,
    recordingUrl: media.recordingUrl,
    recordingComplete: order.recordingComplete,
    recordingDurationSec: order.recordingDurationSec,
    beforeUrls: media.beforeUrls,
    afterUrls: media.afterUrls,
    workNotes: order.workNotes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    addressLine:
      order.deliveryAddressLine ?? order.quote?.request.addressLine ?? null,
    customer: order.customer,
    branch: order.branch,
    worker: order.worker,
    service: order.service,
    product: order.product,
    quote: order.quote
      ? {
          id: order.quote.id,
          requestId: order.quote.request.id,
          amountCents: order.quote.amountCents,
          scheduledFor: order.quote.scheduledFor,
          message: order.quote.message,
        }
      : null,
    payment: order.payment,
    review: order.review,
    materials: order.materials.map((material) => ({
      id: material.id,
      name: material.name,
      quantity: material.quantity,
      unitPriceCents: material.unitPriceCents,
      product: material.product,
    })),
    events: order.events.map((event) => ({
      id: event.id,
      type: event.type,
      note: event.note,
      createdAt: event.createdAt,
      actorName: event.actor?.name ?? null,
    })),
  };
}

function folioFromSearch(search: string): number | null {
  if (!/^#?\d+$/.test(search)) {
    return null;
  }

  const folio = Number.parseInt(search.replace(/^#/, ""), 10);
  return Number.isSafeInteger(folio) && folio <= MAX_PRISMA_INT ? folio : null;
}

function searchWhere(search: string): Prisma.OrderWhereInput {
  const folio = folioFromSearch(search);

  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      {
        customer: {
          is: { name: { contains: search, mode: "insensitive" } },
        },
      },
      ...(folio === null ? [] : [{ folio: { equals: folio } }]),
    ],
  };
}

function createdAtWhere(input: OrderListInput): Prisma.OrderWhereInput {
  if (!input.from && !input.to) {
    return {};
  }

  return {
    createdAt: {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lt: input.to } : {}),
    },
  };
}

export async function listOrders(
  db: PrismaClient,
  businessId: string,
  input: OrderListInput,
): Promise<TrpcResponse<OrderListResult>> {
  if (
    input.branchId &&
    !(await assertBranchInBusiness(db, businessId, input.branchId))
  ) {
    return fail("NOT_FOUND", 404, "Branch not found");
  }

  // P-WEB-02: the worker filter is tenant-checked, never trusted.
  if (input.workerId) {
    const workers = await db.worker.count({
      where: { id: input.workerId, businessId },
    });

    if (workers === 0) {
      return fail("NOT_FOUND", 404, "Worker not found");
    }
  }

  if (input.cursor) {
    const cursor = await db.order.findFirst({
      where: { id: input.cursor, businessId },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Order cursor not found");
    }
  }

  const orders = await db.order.findMany({
    where: {
      businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.workerId ? { workerId: input.workerId } : {}),
      ...createdAtWhere(input),
      ...(input.search ? searchWhere(input.search) : {}),
    },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: orderListSelect,
  });
  const hasNextPage = orders.length > PAGE_SIZE;
  const page = orders.slice(0, PAGE_SIZE);
  const items = page.map(toOrderListItem);

  return ok(
    {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
    "Orders loaded",
  );
}

export async function getOrderById(
  db: PrismaClient,
  input: { businessId: string; userId: string; id: string },
): Promise<TrpcResponse<OrderDetail>> {
  const order = await db.order.findFirst({
    where: { id: input.id, businessId: input.businessId },
    select: orderDetailSelect,
  });

  if (!order) {
    return fail("NOT_FOUND", 404, "Order not found");
  }

  const [recordingUrl, beforeUrls, afterUrls] = await Promise.all([
    resolveOrderMediaUrl(db, {
      userId: input.userId,
      reference: order.recordingUrl,
    }),
    resolveOrderMediaUrls(db, {
      userId: input.userId,
      references: order.beforeUrls,
    }),
    resolveOrderMediaUrls(db, {
      userId: input.userId,
      references: order.afterUrls,
    }),
  ]);

  return ok(
    toOrderDetail(order, { recordingUrl, beforeUrls, afterUrls }),
    "Order loaded",
  );
}
