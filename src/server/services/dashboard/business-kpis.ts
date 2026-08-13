import "server-only";

import type {
  Prisma,
  OrderStatus,
  PrismaClient,
} from "../../../../generated/prisma";

import {
  ESCROW_PAYMENT_STATUSES,
  PROVIDER_REVENUE_PAYMENT_STATUSES,
  providerRevenueCents,
} from "~/server/services/payments/financial-projections";

const DAY_MS = 24 * 60 * 60 * 1_000;
const WEEK_MS = 7 * DAY_MS;

const weeklyPaymentSelect = {
  providerAmountCents: true,
  providerRefundedCents: true,
  createdAt: true,
  order: { select: { type: true } },
} satisfies Prisma.PaymentSelect;

const recentOrderSelect = {
  id: true,
  folio: true,
  title: true,
  amountCents: true,
  status: true,
  createdAt: true,
  customer: { select: { name: true } },
  branch: { select: { name: true } },
} satisfies Prisma.OrderSelect;

type WeeklyPaymentRow = Prisma.PaymentGetPayload<{
  select: typeof weeklyPaymentSelect;
}>;

type RecentOrderPayload = Prisma.OrderGetPayload<{
  select: typeof recentOrderSelect;
}>;

export type BusinessKpis = {
  revenueCents: number;
  revenueDeltaPct: number | null;
  ordersCount: number;
  serviceOrders: number;
  productOrders: number;
  escrowCents: number;
  escrowOrdersCount: number;
  avgRating: number | null;
  reviewsCount: number;
};

export type WeeklyRevenuePoint = {
  weekStart: Date;
  servicesCents: number;
  productsCents: number;
};

export type OrdersByBranchRow = {
  branchId: string | null;
  branchName: string | null;
  ordersCount: number;
};

export type RecentOrderRow = {
  id: string;
  folio: number;
  title: string;
  customerName: string | null;
  branchName: string | null;
  amountCents: number;
  status: OrderStatus;
  createdAt: Date;
};

type BranchScope = { branchId?: string };

function orderScope(businessId: string, branchId?: string) {
  return {
    businessId,
    ...(branchId ? { branchId } : {}),
  };
}

function paymentScope(businessId: string, branchId?: string) {
  return { order: { is: orderScope(businessId, branchId) } };
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

function revenueFromAggregate(aggregate: {
  _sum: {
    providerAmountCents: number | null;
    providerRefundedCents: number | null;
  };
}): number {
  return providerRevenueCents({
    providerAmountCents: aggregate._sum.providerAmountCents ?? 0,
    providerRefundedCents: aggregate._sum.providerRefundedCents ?? 0,
  });
}

export async function getBusinessKpis(
  db: PrismaClient,
  businessId: string,
  input: BranchScope & { days: number },
): Promise<BusinessKpis> {
  const now = new Date();
  const currentStart = new Date(now.getTime() - input.days * DAY_MS);
  const previousStart = new Date(now.getTime() - input.days * 2 * DAY_MS);
  const scopedOrder = orderScope(businessId, input.branchId);
  const scopedPayment = paymentScope(businessId, input.branchId);

  // Revenue series bucket by `Payment.createdAt` (charge time, XC-27).
  const [currentRevenue, previousRevenue, ordersByType, escrow, reviews] =
    await Promise.all([
      db.payment.aggregate({
        where: {
          ...scopedPayment,
          status: { in: [...PROVIDER_REVENUE_PAYMENT_STATUSES] },
          createdAt: { gte: currentStart, lte: now },
        },
        _sum: { providerAmountCents: true, providerRefundedCents: true },
      }),
      db.payment.aggregate({
        where: {
          ...scopedPayment,
          status: { in: [...PROVIDER_REVENUE_PAYMENT_STATUSES] },
          createdAt: { gte: previousStart, lt: currentStart },
        },
        _sum: { providerAmountCents: true, providerRefundedCents: true },
      }),
      db.order.groupBy({
        by: ["type"],
        where: {
          ...scopedOrder,
          createdAt: { gte: currentStart, lte: now },
        },
        _count: true,
      }),
      db.payment.aggregate({
        where: {
          ...scopedPayment,
          status: { in: [...ESCROW_PAYMENT_STATUSES] },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      db.review.aggregate({
        where: { order: { is: scopedOrder } },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

  const revenueCents = revenueFromAggregate(currentRevenue);
  const previousRevenueCents = revenueFromAggregate(previousRevenue);
  let serviceOrders = 0;
  let productOrders = 0;

  for (const group of ordersByType) {
    if (group.type === "SERVICE") {
      serviceOrders = group._count;
    } else if (group.type === "PRODUCT") {
      productOrders = group._count;
    }
  }

  return {
    revenueCents,
    revenueDeltaPct:
      previousRevenueCents === 0
        ? null
        : Math.round(
            ((revenueCents - previousRevenueCents) / previousRevenueCents) *
              100,
          ),
    ordersCount: serviceOrders + productOrders,
    serviceOrders,
    productOrders,
    escrowCents: escrow._sum.amountCents ?? 0,
    escrowOrdersCount: escrow._count,
    avgRating:
      reviews._avg.rating === null
        ? null
        : Math.round(reviews._avg.rating * 10) / 10,
    reviewsCount: reviews._count,
  };
}

function createEmptyWeeks(weeks: number, firstWeek: Date) {
  return Array.from({ length: weeks }, (_, index): WeeklyRevenuePoint => ({
    weekStart: new Date(firstWeek.getTime() + index * WEEK_MS),
    servicesCents: 0,
    productsCents: 0,
  }));
}

function addPaymentToWeek(
  points: WeeklyRevenuePoint[],
  payment: WeeklyPaymentRow,
  firstWeek: Date,
) {
  if (!payment.order) {
    return;
  }

  const weekStart = startOfUtcWeek(payment.createdAt);
  const index = Math.floor(
    (weekStart.getTime() - firstWeek.getTime()) / WEEK_MS,
  );
  const point = points[index];

  if (!point) {
    return;
  }

  const revenueCents = providerRevenueCents(payment);

  if (payment.order.type === "SERVICE") {
    point.servicesCents += revenueCents;
  } else if (payment.order.type === "PRODUCT") {
    point.productsCents += revenueCents;
  }
}

export async function getWeeklyRevenue(
  db: PrismaClient,
  businessId: string,
  input: BranchScope & { weeks: number },
): Promise<WeeklyRevenuePoint[]> {
  const now = new Date();
  const currentWeek = startOfUtcWeek(now);
  const firstWeek = new Date(
    currentWeek.getTime() - (input.weeks - 1) * WEEK_MS,
  );
  const payments = await db.payment.findMany({
    where: {
      ...paymentScope(businessId, input.branchId),
      status: { in: [...PROVIDER_REVENUE_PAYMENT_STATUSES] },
      createdAt: { gte: firstWeek, lte: now },
    },
    select: weeklyPaymentSelect,
  });
  const points = createEmptyWeeks(input.weeks, firstWeek);

  for (const payment of payments) {
    addPaymentToWeek(points, payment, firstWeek);
  }

  return points;
}

export async function getOrdersByBranch(
  db: PrismaClient,
  businessId: string,
  input: BranchScope & { days: number },
): Promise<OrdersByBranchRow[]> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - input.days * DAY_MS);
  const [groups, branches] = await Promise.all([
    db.order.groupBy({
      by: ["branchId"],
      where: {
        ...orderScope(businessId, input.branchId),
        createdAt: { gte: periodStart, lte: now },
      },
      _count: true,
    }),
    db.branch.findMany({
      where: {
        businessId,
        ...(input.branchId ? { id: input.branchId } : {}),
      },
      select: { id: true, name: true },
    }),
  ]);
  const branchNames = new Map(
    branches.map((branch) => [branch.id, branch.name]),
  );

  return groups
    .map((group): OrdersByBranchRow => ({
      branchId: group.branchId,
      branchName: group.branchId
        ? (branchNames.get(group.branchId) ?? null)
        : null,
      ordersCount: group._count,
    }))
    .sort((left: OrdersByBranchRow, right: OrdersByBranchRow) => {
      const countDifference = right.ordersCount - left.ordersCount;
      return countDifference !== 0
        ? countDifference
        : (left.branchName ?? "").localeCompare(right.branchName ?? "");
    });
}

function toRecentOrder(payload: RecentOrderPayload): RecentOrderRow {
  return {
    id: payload.id,
    folio: payload.folio,
    title: payload.title,
    customerName: payload.customer.name,
    branchName: payload.branch?.name ?? null,
    amountCents: payload.amountCents,
    status: payload.status,
    createdAt: payload.createdAt,
  };
}

export async function getRecentOrders(
  db: PrismaClient,
  businessId: string,
  input: BranchScope & { limit: number },
): Promise<RecentOrderRow[]> {
  const orders = await db.order.findMany({
    where: orderScope(businessId, input.branchId),
    take: input.limit,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: recentOrderSelect,
  });

  return orders.map(toRecentOrder);
}
