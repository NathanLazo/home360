import "server-only";

import type { OrderStatus, Prisma, PrismaClient } from "@generated/prisma";

import {
  PROVIDER_REVENUE_PAYMENT_STATUSES,
  providerRevenueCents,
} from "~/server/services/payments/financial-projections";

const DAY_MS = 24 * 60 * 60 * 1_000;

/** The activity heatmap always spans 13 full weeks: fits a phone width. */
export const ACTIVITY_WEEKS = 13;

const dailyPaymentSelect = {
  providerAmountCents: true,
  providerRefundedCents: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

export type DailyRevenuePoint = {
  date: Date;
  revenueCents: number;
};

export type DailyOrderCount = {
  date: Date;
  count: number;
};

/** Cumulative stages: each one counts the orders that reached it. */
export type OrderPipeline = {
  created: number;
  paid: number;
  started: number;
  completed: number;
};

export type BusinessInsights = {
  dailyRevenue: DailyRevenuePoint[];
  pipeline: OrderPipeline;
  activity: DailyOrderCount[];
};

type InsightsInput = { branchId?: string; days: number };

const PAID_STATUSES: readonly OrderStatus[] = [
  "PAID",
  "IN_PROGRESS",
  "SHIPPING",
  "COMPLETED",
  "DISPUTED",
];
const STARTED_STATUSES: readonly OrderStatus[] = [
  "IN_PROGRESS",
  "SHIPPING",
  "COMPLETED",
  "DISPUTED",
];

function orderScope(businessId: string, branchId?: string) {
  return { businessId, ...(branchId ? { branchId } : {}) };
}

function startOfUtcDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function dayIndex(firstDay: Date, date: Date): number {
  return Math.floor(
    (startOfUtcDay(date).getTime() - firstDay.getTime()) / DAY_MS,
  );
}

function createDays<T>(
  count: number,
  firstDay: Date,
  build: (date: Date) => T,
) {
  return Array.from({ length: count }, (_, index) =>
    build(new Date(firstDay.getTime() + index * DAY_MS)),
  );
}

function buildPipeline(
  groups: Array<{ status: OrderStatus; _count: number }>,
): OrderPipeline {
  const countIn = (statuses: readonly OrderStatus[]) =>
    groups
      .filter((group) => statuses.includes(group.status))
      .reduce((total, group) => total + group._count, 0);

  return {
    created: groups
      .filter((group) => group.status !== "CANCELLED")
      .reduce((total, group) => total + group._count, 0),
    paid: countIn(PAID_STATUSES),
    started: countIn(STARTED_STATUSES),
    completed: countIn(["COMPLETED"]),
  };
}

export async function getBusinessInsights(
  db: PrismaClient,
  businessId: string,
  input: InsightsInput,
): Promise<BusinessInsights> {
  const now = new Date();
  const today = startOfUtcDay(now);
  const revenueStart = new Date(today.getTime() - (input.days - 1) * DAY_MS);
  const activityStart = new Date(
    today.getTime() - (ACTIVITY_WEEKS * 7 - 1) * DAY_MS,
  );
  const scopedOrder = orderScope(businessId, input.branchId);

  const [payments, statusGroups, activityOrders] = await Promise.all([
    db.payment.findMany({
      where: {
        order: { is: scopedOrder },
        status: { in: [...PROVIDER_REVENUE_PAYMENT_STATUSES] },
        createdAt: { gte: revenueStart, lte: now },
      },
      select: dailyPaymentSelect,
    }),
    db.order.groupBy({
      by: ["status"],
      where: { ...scopedOrder, createdAt: { gte: revenueStart, lte: now } },
      _count: true,
    }),
    db.order.findMany({
      where: { ...scopedOrder, createdAt: { gte: activityStart, lte: now } },
      select: { createdAt: true },
    }),
  ]);

  const dailyRevenue = createDays(input.days, revenueStart, (date) => ({
    date,
    revenueCents: 0,
  }));
  for (const payment of payments) {
    const point = dailyRevenue[dayIndex(revenueStart, payment.createdAt)];
    if (point) {
      point.revenueCents += providerRevenueCents(payment);
    }
  }

  const activity = createDays(ACTIVITY_WEEKS * 7, activityStart, (date) => ({
    date,
    count: 0,
  }));
  for (const order of activityOrders) {
    const point = activity[dayIndex(activityStart, order.createdAt)];
    if (point) {
      point.count += 1;
    }
  }

  return {
    dailyRevenue,
    pipeline: buildPipeline(statusGroups),
    activity,
  };
}
