import "server-only";

import {
  PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";

import type { CorporateOrderListInput } from "~/server/api/schemas/corporate";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { savedByRateCents } from "~/server/services/payments/commission-resolution";
import { getFinancialMonthBounds } from "~/server/services/payments/balances";
import { ACTIVE_ORDER_STATUSES } from "~/server/services/business/order-activity";

const DEFAULT_ORDER_PAGE_SIZE = 20;

const corporateOrderSelect = {
  id: true,
  folio: true,
  title: true,
  type: true,
  status: true,
  amountCents: true,
  createdAt: true,
  business: { select: { name: true } },
  corporateLocation: { select: { id: true, name: true } },
} satisfies Prisma.OrderSelect;

type CorporateOrderPayload = Prisma.OrderGetPayload<{
  select: typeof corporateOrderSelect;
}>;

export type CorporateOrderItem = {
  id: string;
  folio: number;
  title: string;
  type: CorporateOrderPayload["type"];
  status: CorporateOrderPayload["status"];
  amountCents: number;
  createdAt: Date;
  businessName: string;
  location: { id: string; name: string } | null;
};

export type CorporateOrderListResult = {
  items: CorporateOrderItem[];
  nextCursor: string | null;
};

function toCorporateOrderItem(
  order: CorporateOrderPayload,
): CorporateOrderItem {
  return {
    id: order.id,
    folio: order.folio,
    title: order.title,
    type: order.type,
    status: order.status,
    amountCents: order.amountCents,
    createdAt: order.createdAt,
    businessName: order.business.name,
    location: order.corporateLocation,
  };
}

/**
 * Consolidated orders across every location of the account. When a
 * `locationId` filter arrives, ownership is validated with a single query on
 * `{ id, corporateAccountId }`: a foreign id and a missing id are the same
 * `NOT_FOUND`, and nothing is filtered after loading rows.
 */
export async function listCorporateOrders(
  db: PrismaClient,
  corporateAccountId: string,
  input: CorporateOrderListInput,
): Promise<TrpcResponse<CorporateOrderListResult>> {
  if (input.locationId) {
    const location = await db.corporateLocation.findFirst({
      where: { id: input.locationId, corporateAccountId },
      select: { id: true },
    });

    if (!location) {
      return fail("NOT_FOUND", 404, "Corporate location not found");
    }
  }

  if (input.cursor) {
    const cursor = await db.order.findFirst({
      where: { id: input.cursor, corporateAccountId },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Order cursor not found");
    }
  }

  const pageSize = input.limit ?? DEFAULT_ORDER_PAGE_SIZE;
  const orders = await db.order.findMany({
    where: {
      corporateAccountId,
      ...(input.locationId ? { corporateLocationId: input.locationId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: corporateOrderSelect,
  });
  const hasNextPage = orders.length > pageSize;
  const items = orders.slice(0, pageSize).map(toCorporateOrderItem);

  return ok(
    {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
    "Corporate orders loaded",
  );
}

/**
 * Payment states that count as "charged" for corporate spending, matching the
 * XC-03 net policy: everything captured stays in (escrow, transitional and
 * released states, plus PARTIALLY_REFUNDED net of `refundedCents`), while a
 * fully REFUNDED payment drops out entirely — the account did not end up
 * paying for it, so it neither spends nor "saves" commission.
 */
const CHARGED_PAYMENT_STATUSES = [
  PaymentStatus.IN_ESCROW,
  PaymentStatus.REFUNDING,
  PaymentStatus.RELEASING,
  PaymentStatus.RELEASED,
  PaymentStatus.PARTIALLY_REFUNDED,
] as const satisfies readonly PaymentStatus[];

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Frozen XC-26 snapshots consumed by `savedByRateCents`; nothing else. */
const commissionReferenceSelect = {
  providerPlanCommissionCents: true,
  commissionCents: true,
} satisfies Prisma.PaymentSelect;

export type CorporateOverview = {
  spentCents: number;
  ordersActive: number;
  ordersMonth: number;
  locationsActive: number;
  savedByRateCents: number;
};

/**
 * Resolves the `[start, end)` UTC bounds of a "YYYY-MM" month interpreted in
 * the business time zone (America/Chihuahua), reusing the canonical XC-03
 * helper. Noon UTC on the 15th is always inside the same calendar month in
 * that zone (UTC-6/-7), so the conversion happens exactly once.
 */
function monthBoundsFor(month: string | undefined, now: Date) {
  if (month === undefined) {
    return getFinancialMonthBounds(now);
  }

  const match = MONTH_PATTERN.exec(month);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  const midMonthUtc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, 15, 12),
  );

  return getFinancialMonthBounds(midMonthUtc);
}

export async function getCorporateOverview(
  db: PrismaClient,
  corporateAccountId: string,
  input: { month?: string; locationId?: string; now?: Date },
): Promise<TrpcResponse<CorporateOverview>> {
  const bounds = monthBoundsFor(input.month, input.now ?? new Date());

  if (!bounds) {
    return fail("VALIDATION_ERROR", 400, "Invalid overview month");
  }

  if (input.locationId) {
    const location = await db.corporateLocation.findFirst({
      where: { id: input.locationId, corporateAccountId },
      select: { id: true },
    });

    if (!location) {
      return fail("NOT_FOUND", 404, "Corporate location not found");
    }
  }

  // Location filter (workstream D): every order-derived KPI narrows to the
  // location; the active-locations count stays account-wide.
  const locationFilter = input.locationId
    ? { corporateLocationId: input.locationId }
    : {};
  const chargedPaymentWhere = {
    order: { is: { corporateAccountId, ...locationFilter } },
    status: { in: [...CHARGED_PAYMENT_STATUSES] },
    createdAt: { gte: bounds.start, lt: bounds.end },
  } satisfies Prisma.PaymentWhereInput;

  const [spending, savingsRows, ordersActive, ordersMonth, locationsActive] =
    await Promise.all([
      db.payment.aggregate({
        where: chargedPaymentWhere,
        _sum: { amountCents: true, refundedCents: true },
      }),
      // `savedByRateCents` compares two frozen snapshots per payment (XC-26),
      // so the rows are reduced with the pure helper instead of re-deriving
      // the saving from any current plan or corporate term.
      db.payment.findMany({
        where: chargedPaymentWhere,
        select: commissionReferenceSelect,
      }),
      db.order.count({
        where: {
          corporateAccountId,
          ...locationFilter,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
        },
      }),
      db.order.count({
        where: {
          corporateAccountId,
          ...locationFilter,
          createdAt: { gte: bounds.start, lt: bounds.end },
        },
      }),
      db.corporateLocation.count({
        where: { corporateAccountId, isActive: true },
      }),
    ]);

  const chargedCents = spending._sum.amountCents ?? 0;
  const refundedCents = spending._sum.refundedCents ?? 0;

  return ok(
    {
      spentCents: Math.max(0, chargedCents - refundedCents),
      ordersActive,
      ordersMonth,
      locationsActive,
      savedByRateCents: savingsRows.reduce(
        (total, payment) => total + savedByRateCents(payment),
        0,
      ),
    },
    "Corporate overview loaded",
  );
}
