import "server-only";

import type {
  Prisma,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from "@generated/prisma";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { assertBranchInBusiness } from "~/server/services/business/branch-access";
import type { OrderListInput } from "~/server/services/orders/order.schema";

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
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true, email: true } },
  branch: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, category: true } },
  product: { select: { id: true, name: true, sku: true } },
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
  recordingUrl: string | null;
  recordingComplete: boolean;
  recordingDurationSec: number | null;
  beforeUrls: string[];
  afterUrls: string[];
  workNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string | null; email: string | null };
  branch: { id: string; name: string } | null;
  service: { id: string; name: string; category: string } | null;
  product: { id: string; name: string; sku: string } | null;
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
};

function toOrderListItem(order: OrderListPayload): OrderListItem {
  return {
    id: order.id,
    folio: order.folio,
    title: order.title,
    type: order.type,
    customerName: order.customer.name,
    branchName: order.branch?.name ?? null,
    amountCents: order.amountCents,
    status: order.status,
    createdAt: order.createdAt,
  };
}

function toOrderDetail(order: OrderDetailPayload): OrderDetail {
  return {
    id: order.id,
    folio: order.folio,
    type: order.type,
    title: order.title,
    status: order.status,
    amountCents: order.amountCents,
    quantity: order.quantity,
    recordingUrl: order.recordingUrl,
    recordingComplete: order.recordingComplete,
    recordingDurationSec: order.recordingDurationSec,
    beforeUrls: order.beforeUrls,
    afterUrls: order.afterUrls,
    workNotes: order.workNotes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer,
    branch: order.branch,
    service: order.service,
    product: order.product,
    payment: order.payment,
    review: order.review,
    materials: order.materials.map((material) => ({
      id: material.id,
      name: material.name,
      quantity: material.quantity,
      unitPriceCents: material.unitPriceCents,
      product: material.product,
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

  if (input.workerId) {
    // Tenancy (P-WEB-02): a foreign or unknown worker answers the same
    // generic NOT_FOUND as a foreign branch, so the response never reveals
    // whether the worker exists in another business.
    const worker = await db.worker.findFirst({
      where: { id: input.workerId, businessId },
      select: { id: true },
    });

    if (!worker) {
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
      ...(input.workerId ? { workerId: input.workerId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
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
  businessId: string,
  id: string,
): Promise<TrpcResponse<OrderDetail>> {
  const order = await db.order.findFirst({
    where: { id, businessId },
    select: orderDetailSelect,
  });

  if (!order) {
    return fail("NOT_FOUND", 404, "Order not found");
  }

  return ok(toOrderDetail(order), "Order loaded");
}
