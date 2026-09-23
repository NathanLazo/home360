import "server-only";

import {
  type DisputeStatus,
  type OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  type GuaranteeType,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import { createDownloadUrl } from "~/server/services/media/blob";
import { isAwaitingConfirmation } from "~/server/services/orders/work-cycle";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const consumerOrderSelect = {
  id: true,
  folio: true,
  title: true,
  type: true,
  status: true,
  amountCents: true,
  quantity: true,
  createdAt: true,
  customerId: true,
  beforeUrls: true,
  afterUrls: true,
  workNotes: true,
  recordingUrl: true,
  recordingDurationSec: true,
  recordingComplete: true,
  recordingJustification: true,
  deliveryAddressLine: true,
  corporateLocation: { select: { id: true, name: true } },
  business: {
    select: {
      id: true,
      name: true,
      ratingAvg: true,
      ratingCount: true,
      guaranteeType: true,
    },
  },
  branch: { select: { name: true } },
  worker: { select: { fullName: true, specialty: true, ratingAvg: true } },
  quote: {
    select: {
      id: true,
      amountCents: true,
      scheduledFor: true,
      message: true,
      request: {
        select: { id: true, addressLine: true, category: true },
      },
    },
  },
  materials: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, quantity: true, unitPriceCents: true },
  },
  payment: {
    select: {
      status: true,
      amountCents: true,
      providerAmountCents: true,
      serviceFeeCentsApplied: true,
      refundedCents: true,
      escrowReleaseAt: true,
      releasedAt: true,
      createdAt: true,
    },
  },
  dispute: { select: { id: true, status: true, urgency: true } },
  review: { select: { rating: true, comment: true, createdAt: true } },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, note: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

export type SignedEvidence = { pathname: string; url: string };

export type ConsumerOrderDetail = {
  id: string;
  folio: number;
  title: string;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  createdAt: Date;
  addressLine: string | null;
  location: { id: string; name: string } | null;
  business: {
    id: string;
    name: string;
    ratingAvg: number | null;
    ratingCount: number;
    guaranteeType: GuaranteeType;
    branchName: string | null;
  };
  worker: {
    fullName: string;
    specialty: string | null;
    ratingAvg: number | null;
  } | null;
  quote: {
    id: string;
    amountCents: number;
    scheduledFor: Date | null;
    message: string | null;
    requestId: string;
    category: string;
  } | null;
  evidence: {
    before: SignedEvidence[];
    after: SignedEvidence[];
    workNotes: string | null;
    materials: {
      id: string;
      name: string;
      quantity: number;
      unitPriceCents: number;
    }[];
  };
  recording: {
    available: boolean;
    complete: boolean;
    durationSec: number | null;
    justification: string | null;
  };
  /** Money breakdown; the customer never sees the provider commission. */
  amounts: {
    laborCents: number;
    serviceFeeCents: number;
    totalCents: number;
    refundedCents: number;
  };
  payment: {
    status: PaymentStatus;
    paidAt: Date;
    escrowReleaseAt: Date | null;
    releasedAt: Date | null;
  } | null;
  dispute: { id: string; status: DisputeStatus } | null;
  review: { rating: number; comment: string | null; createdAt: Date } | null;
  timeline: {
    id: string;
    type: OrderEventType;
    note: string | null;
    createdAt: Date;
  }[];
  /** Server-computed affordances so every client applies the same guards. */
  actions: {
    canConfirm: boolean;
    canRequestRework: boolean;
    canOpenDispute: boolean;
    canCancel: boolean;
    canReview: boolean;
    canPay: boolean;
  };
};

/** Who is asking: the customer by user id, or a corporate account. */
export type ConsumerOrderScope =
  | { kind: "CUSTOMER"; customerId: string }
  | { kind: "CORPORATE"; corporateAccountId: string };

const ESCROW_OPEN_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SHIPPING,
];

async function signPathnames(
  db: PrismaClient,
  userId: string,
  pathnames: string[],
): Promise<SignedEvidence[]> {
  const signed: SignedEvidence[] = [];

  for (const pathname of pathnames) {
    const grant = await createDownloadUrl(db, { userId, pathname });

    if (grant.ok) {
      signed.push({ pathname, url: grant.data.url });
    }
  }

  return signed;
}

/**
 * Consumer-side order detail (workstream D): C6 tracking extras and the
 * corporate portal detail share it. Tenant is enforced in the Prisma where;
 * evidence URLs are signed for the order's customer (the corporate owner for
 * corporate orders), who is always authorized to read them.
 */
export async function getConsumerOrderDetail(
  db: PrismaClient,
  scope: ConsumerOrderScope,
  orderId: string,
): Promise<ServiceResult<ConsumerOrderDetail>> {
  const where: Prisma.OrderWhereInput =
    scope.kind === "CUSTOMER"
      ? { id: orderId, customerId: scope.customerId }
      : { id: orderId, corporateAccountId: scope.corporateAccountId };
  const order = await db.order.findFirst({
    where,
    select: consumerOrderSelect,
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  const settings = order.payment
    ? null
    : await db.platformSettings.findUnique({
        where: { id: 1 },
        select: { customerServiceFeeCents: true },
      });
  const serviceFeeCents =
    order.payment?.serviceFeeCentsApplied ??
    settings?.customerServiceFeeCents ??
    0;
  const laborCents = order.payment?.providerAmountCents ?? order.amountCents;
  const [before, after] = await Promise.all([
    signPathnames(db, order.customerId, order.beforeUrls),
    signPathnames(db, order.customerId, order.afterUrls),
  ]);
  const escrowHeld =
    ESCROW_OPEN_STATUSES.includes(order.status) &&
    order.payment?.status === PaymentStatus.IN_ESCROW &&
    order.dispute === null;
  const awaitingConfirmation =
    order.type === OrderType.PRODUCT || isAwaitingConfirmation(order.events);

  return svcOk({
    id: order.id,
    folio: order.folio,
    title: order.title,
    type: order.type,
    status: order.status,
    quantity: order.quantity,
    createdAt: order.createdAt,
    addressLine:
      order.quote?.request.addressLine ?? order.deliveryAddressLine ?? null,
    location: order.corporateLocation,
    business: {
      id: order.business.id,
      name: order.business.name,
      ratingAvg: order.business.ratingAvg,
      ratingCount: order.business.ratingCount,
      guaranteeType: order.business.guaranteeType,
      branchName: order.branch?.name ?? null,
    },
    worker: order.worker,
    quote: order.quote
      ? {
          id: order.quote.id,
          amountCents: order.quote.amountCents,
          scheduledFor: order.quote.scheduledFor,
          message: order.quote.message,
          requestId: order.quote.request.id,
          category: order.quote.request.category,
        }
      : null,
    evidence: {
      before,
      after,
      workNotes: order.workNotes,
      materials: order.materials,
    },
    recording: {
      available: order.recordingUrl !== null,
      complete: order.recordingComplete,
      durationSec: order.recordingDurationSec,
      justification: order.recordingJustification,
    },
    amounts: {
      laborCents,
      serviceFeeCents,
      totalCents: order.payment?.amountCents ?? laborCents + serviceFeeCents,
      refundedCents: order.payment?.refundedCents ?? 0,
    },
    payment: order.payment
      ? {
          status: order.payment.status,
          paidAt: order.payment.createdAt,
          escrowReleaseAt: order.payment.escrowReleaseAt,
          releasedAt: order.payment.releasedAt,
        }
      : null,
    dispute: order.dispute
      ? { id: order.dispute.id, status: order.dispute.status }
      : null,
    review: order.review,
    timeline: order.events,
    actions: {
      canConfirm: escrowHeld && awaitingConfirmation,
      canRequestRework:
        escrowHeld &&
        order.type === OrderType.SERVICE &&
        order.status === OrderStatus.IN_PROGRESS &&
        isAwaitingConfirmation(order.events),
      canOpenDispute: escrowHeld,
      canCancel:
        order.status === OrderStatus.PENDING &&
        (order.payment === null ||
          order.payment.status === PaymentStatus.PENDING),
      canReview:
        order.status === OrderStatus.COMPLETED && order.review === null,
      canPay: order.status === OrderStatus.PENDING && order.payment === null,
    },
  });
}
