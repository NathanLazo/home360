import "server-only";

import type {
  DisputeResolution,
  DisputeStatus,
  FulfillmentMethod,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@generated/prisma";

import type { AdminOrderListInput } from "~/server/services/admin/admin-order.schema";
import { effectiveFulfillmentMethod } from "~/server/services/orders/order-actions";
import {
  resolveOrderMediaUrl,
  signMediaPathnames,
  type SignedMedia,
} from "~/server/services/orders/order-media";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PAGE_SIZE = 25;
const MAX_PRISMA_INT = 2_147_483_647;

const adminOrderListSelect = {
  id: true,
  folio: true,
  title: true,
  type: true,
  status: true,
  fulfillmentMethod: true,
  amountCents: true,
  createdAt: true,
  customer: { select: { id: true, name: true } },
  business: { select: { id: true, name: true } },
  payment: { select: { status: true } },
  dispute: { select: { id: true, status: true } },
} satisfies Prisma.OrderSelect;

const adminOrderDetailSelect = {
  id: true,
  folio: true,
  type: true,
  title: true,
  status: true,
  amountCents: true,
  quantity: true,
  createdAt: true,
  updatedAt: true,
  fulfillmentMethod: true,
  deliveryAddressLine: true,
  deliveryLatitude: true,
  deliveryLongitude: true,
  deliveryEvidenceUrls: true,
  deliveryNote: true,
  pickedUpAt: true,
  stockHeldQty: true,
  beforeUrls: true,
  afterUrls: true,
  workNotes: true,
  recordingUrl: true,
  recordingComplete: true,
  recordingDurationSec: true,
  recordingJustification: true,
  customer: { select: { id: true, name: true, email: true } },
  business: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, address: true } },
  worker: { select: { id: true, fullName: true } },
  service: { select: { id: true, name: true, category: true } },
  product: { select: { id: true, name: true, sku: true } },
  corporateAccount: { select: { id: true, name: true } },
  quote: {
    select: {
      id: true,
      amountCents: true,
      scheduledFor: true,
      request: { select: { id: true, addressLine: true, category: true } },
    },
  },
  payment: {
    select: {
      id: true,
      status: true,
      method: true,
      amountCents: true,
      providerAmountCents: true,
      serviceFeeCentsApplied: true,
      commissionCents: true,
      refundedCents: true,
      escrowReleaseAt: true,
      releasedAt: true,
      createdAt: true,
    },
  },
  dispute: {
    select: { id: true, status: true, resolution: true, resolvedAt: true },
  },
  review: { select: { rating: true, comment: true, createdAt: true } },
  materials: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, quantity: true, unitPriceCents: true },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type AdminOrderListItem = {
  id: string;
  folio: number;
  title: string;
  type: OrderType;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  amountCents: number;
  createdAt: Date;
  customer: { id: string; name: string | null };
  business: { id: string; name: string };
  paymentStatus: PaymentStatus | null;
  dispute: { id: string; status: DisputeStatus } | null;
};

export type AdminOrderList = {
  items: AdminOrderListItem[];
  nextCursor: string | null;
};

export type AdminOrderDetail = {
  id: string;
  folio: number;
  type: OrderType;
  title: string;
  status: OrderStatus;
  amountCents: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  /** PRODUCT delivery snapshot or, for SERVICE, the request address. */
  addressLine: string | null;
  fulfillment: {
    method: FulfillmentMethod | null;
    deliveryLatitude: number | null;
    deliveryLongitude: number | null;
    deliveryNote: string | null;
    pickedUpAt: Date | null;
    /** Units still reserved from ProductStock (D10-4). */
    stockHeldQty: number;
  };
  customer: { id: string; name: string | null; email: string | null };
  business: { id: string; name: string };
  branch: { id: string; name: string; address: string } | null;
  worker: { id: string; fullName: string } | null;
  service: { id: string; name: string; category: string } | null;
  product: { id: string; name: string; sku: string } | null;
  corporateAccount: { id: string; name: string } | null;
  quote: {
    id: string;
    requestId: string;
    category: string;
    amountCents: number;
    scheduledFor: Date | null;
  } | null;
  payment: {
    id: string;
    status: PaymentStatus;
    method: PaymentMethod;
    amountCents: number;
    providerAmountCents: number;
    serviceFeeCents: number;
    commissionCents: number;
    refundedCents: number;
    escrowReleaseAt: Date | null;
    releasedAt: Date | null;
    createdAt: Date;
  } | null;
  dispute: {
    id: string;
    status: DisputeStatus;
    resolution: DisputeResolution | null;
    resolvedAt: Date | null;
  } | null;
  review: { rating: number; comment: string | null; createdAt: Date } | null;
  /** Every media reference signed for the admin (MA-02 admin branch). */
  evidence: {
    before: SignedMedia[];
    after: SignedMedia[];
    delivery: SignedMedia[];
    workNotes: string | null;
    recording: {
      url: string | null;
      complete: boolean;
      durationSec: number | null;
      justification: string | null;
    };
  };
  materials: {
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  timeline: {
    id: string;
    type: OrderEventType;
    note: string | null;
    createdAt: Date;
    actorName: string | null;
  }[];
};

function folioFromSearch(search: string): number | null {
  if (!/^#?\d+$/.test(search)) {
    return null;
  }

  const folio = Number.parseInt(search.replace(/^#/, ""), 10);
  return Number.isSafeInteger(folio) && folio <= MAX_PRISMA_INT ? folio : null;
}

function searchWhere(search: string): Prisma.OrderWhereInput {
  const folio = folioFromSearch(search);
  const contains = { contains: search, mode: "insensitive" as const };

  return {
    OR: [
      ...(folio === null ? [] : [{ folio: { equals: folio } }]),
      { title: contains },
      { customer: { is: { name: contains } } },
      { business: { is: { name: contains } } },
    ],
  };
}

/** D10-14: platform-wide order list (all types), cursor-paginated. */
export async function listAdminOrders(
  db: PrismaClient,
  input: AdminOrderListInput,
): Promise<ServiceResult<AdminOrderList>> {
  if (input.cursor) {
    const cursor = await db.order.findUnique({
      where: { id: input.cursor },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Order cursor not found");
    }
  }

  const rows = await db.order.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.search ? searchWhere(input.search) : {}),
    },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: adminOrderListSelect,
  });
  const page = rows.slice(0, PAGE_SIZE);

  return svcOk({
    items: page.map((row) => ({
      id: row.id,
      folio: row.folio,
      title: row.title,
      type: row.type,
      status: row.status,
      fulfillmentMethod: effectiveFulfillmentMethod(
        row.type,
        row.fulfillmentMethod,
      ),
      amountCents: row.amountCents,
      createdAt: row.createdAt,
      customer: row.customer,
      business: row.business,
      paymentStatus: row.payment?.status ?? null,
      dispute: row.dispute,
    })),
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  });
}

/**
 * D10-14 order detail for the admin: type, fulfillment, money, dispute,
 * evidence (signed for the admin) and the full timeline. The pickup code is
 * never exposed outside the customer's tracking view.
 */
export async function getAdminOrder(
  db: PrismaClient,
  input: { adminUserId: string; id: string },
): Promise<ServiceResult<AdminOrderDetail>> {
  const order = await db.order.findUnique({
    where: { id: input.id },
    select: adminOrderDetailSelect,
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  const userId = input.adminUserId;
  const [before, after, delivery, recordingUrl] = await Promise.all([
    signMediaPathnames(db, { userId, pathnames: order.beforeUrls }),
    signMediaPathnames(db, { userId, pathnames: order.afterUrls }),
    signMediaPathnames(db, { userId, pathnames: order.deliveryEvidenceUrls }),
    resolveOrderMediaUrl(db, { userId, reference: order.recordingUrl }),
  ]);

  return svcOk({
    id: order.id,
    folio: order.folio,
    type: order.type,
    title: order.title,
    status: order.status,
    amountCents: order.amountCents,
    quantity: order.quantity,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    addressLine:
      order.deliveryAddressLine ?? order.quote?.request.addressLine ?? null,
    fulfillment: {
      method: effectiveFulfillmentMethod(order.type, order.fulfillmentMethod),
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      deliveryNote: order.deliveryNote,
      pickedUpAt: order.pickedUpAt,
      stockHeldQty: order.stockHeldQty,
    },
    customer: order.customer,
    business: order.business,
    branch: order.branch,
    worker: order.worker,
    service: order.service,
    product: order.product,
    corporateAccount: order.corporateAccount,
    quote: order.quote
      ? {
          id: order.quote.id,
          requestId: order.quote.request.id,
          category: order.quote.request.category,
          amountCents: order.quote.amountCents,
          scheduledFor: order.quote.scheduledFor,
        }
      : null,
    payment: order.payment
      ? {
          id: order.payment.id,
          status: order.payment.status,
          method: order.payment.method,
          amountCents: order.payment.amountCents,
          providerAmountCents: order.payment.providerAmountCents,
          serviceFeeCents: order.payment.serviceFeeCentsApplied,
          commissionCents: order.payment.commissionCents,
          refundedCents: order.payment.refundedCents,
          escrowReleaseAt: order.payment.escrowReleaseAt,
          releasedAt: order.payment.releasedAt,
          createdAt: order.payment.createdAt,
        }
      : null,
    dispute: order.dispute,
    review: order.review,
    evidence: {
      before,
      after,
      delivery,
      workNotes: order.workNotes,
      recording: {
        url: recordingUrl,
        complete: order.recordingComplete,
        durationSec: order.recordingDurationSec,
        justification: order.recordingJustification,
      },
    },
    materials: order.materials,
    timeline: order.events.map((event) => ({
      id: event.id,
      type: event.type,
      note: event.note,
      createdAt: event.createdAt,
      actorName: event.actor?.name ?? null,
    })),
  });
}
