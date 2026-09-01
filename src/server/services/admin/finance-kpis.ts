import {
  BusinessStatus,
  InvoiceStatus,
  LoyaltyBonusStatus,
  type Prisma,
  type PrismaClient,
  WithdrawalStatus,
} from "@generated/prisma";

import {
  WITHDRAWALS_PAGE_SIZE,
} from "~/app/[locale]/admin/finance/_components/finance.schema";
import { getFinancialMonthBounds } from "../payments/balances";
import {
  ESCROW_PAYMENT_STATUSES,
  PLATFORM_EARNING_PAYMENT_STATUSES,
  netPlatformRevenueCents,
  platformGrossRevenueCents,
} from "../payments/financial-projections";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

type FinanceDb = Pick<
  PrismaClient,
  "business" | "invoice" | "loyaltyBonus" | "payment" | "withdrawal"
>;

export interface FinanceKpis {
  month: string;
  platformGrossRevenueCents: number;
  platformGrossRevenueDeltaPct: number | null;
  subscriptionCents: number;
  activeBusinesses: number;
  escrowCents: number;
  escrowOrdersCount: number;
  pendingWithdrawalsCents: number;
  pendingWithdrawalsCount: number;
}

export interface RevenueBreakdown {
  series: Array<{
    month: string;
    platformGrossRevenueCents: number;
    subscriptionCents: number;
  }>;
  totals: {
    platformGrossRevenueCents: number;
    subscriptionCents: number;
    loyaltyBonusPaidCents: number;
    /** Operating liability: PENDING bonuses never reduce paid income. */
    loyaltyBonusPendingCents: number;
    netRevenueCents: number;
  };
}

function monthKey(bounds: { start: Date }): string {
  return bounds.start.toISOString().slice(0, 7);
}

/** Resolves "YYYY-MM" against the platform's financial calendar. */
function boundsForMonth(month: string | undefined, now: Date) {
  if (month === undefined) {
    return getFinancialMonthBounds(now);
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (
    year === undefined ||
    monthNumber === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(monthNumber)
  ) {
    return null;
  }

  // Midday avoids landing outside the month through any UTC offset.
  const anchor = new Date(Date.UTC(year, monthNumber - 1, 15, 12));
  return getFinancialMonthBounds(anchor);
}

function previousMonthBounds(currentStart: Date) {
  return getFinancialMonthBounds(new Date(currentStart.getTime() - 1));
}

function deltaPct(current: number, previous: number): number | null {
  return previous === 0
    ? null
    : Math.round(((current - previous) / previous) * 100);
}

/** Payment earnings bucket by `Payment.createdAt` (charge time, XC-27). */
function platformEarningWhere(range: {
  start: Date;
  end: Date;
}): Prisma.PaymentWhereInput {
  return {
    status: { in: [...PLATFORM_EARNING_PAYMENT_STATUSES] },
    createdAt: { gte: range.start, lt: range.end },
  };
}

/** PAID subscription invoices bucket by `Invoice.issuedAt` (XC-27). */
function paidInvoiceWhere(range: {
  start: Date;
  end: Date;
}): Prisma.InvoiceWhereInput {
  return {
    status: InvoiceStatus.PAID,
    issuedAt: { gte: range.start, lt: range.end },
  };
}

const platformEarningSum = {
  commissionCents: true,
  serviceFeeCentsApplied: true,
  serviceFeeRefundedCents: true,
} as const;

/** W12 gross platform revenue over aggregated ledger `_sum` columns. */
function grossFromAggregate(aggregate: {
  _sum: {
    commissionCents: number | null;
    serviceFeeCentsApplied: number | null;
    serviceFeeRefundedCents: number | null;
  };
}): number {
  return platformGrossRevenueCents({
    commissionCents: aggregate._sum.commissionCents ?? 0,
    serviceFeeCentsApplied: aggregate._sum.serviceFeeCentsApplied ?? 0,
    serviceFeeRefundedCents: aggregate._sum.serviceFeeRefundedCents ?? 0,
  });
}

export async function getFinanceKpis(
  deps: { db: FinanceDb },
  input: { month?: string; now?: Date } = {},
): Promise<ServiceResult<FinanceKpis>> {
  const now = input.now ?? new Date();
  const month = boundsForMonth(input.month, now);

  if (!month) {
    return svcFail("CONFLICT", "Invalid month");
  }

  const previous = previousMonthBounds(month.start);

  const [
    earnings,
    previousEarnings,
    subscriptions,
    activeBusinesses,
    escrow,
    pendingWithdrawals,
  ] = await Promise.all([
    deps.db.payment.aggregate({
      where: platformEarningWhere(month),
      _sum: platformEarningSum,
    }),
    deps.db.payment.aggregate({
      where: platformEarningWhere(previous),
      _sum: platformEarningSum,
    }),
    deps.db.invoice.aggregate({
      where: paidInvoiceWhere(month),
      _sum: { amountCents: true },
    }),
    deps.db.business.count({ where: { status: BusinessStatus.ACTIVE } }),
    deps.db.payment.aggregate({
      where: { status: { in: [...ESCROW_PAYMENT_STATUSES] } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    deps.db.withdrawal.aggregate({
      where: { status: WithdrawalStatus.REQUESTED },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const grossCents = grossFromAggregate(earnings);

  return svcOk({
    month: monthKey(month),
    platformGrossRevenueCents: grossCents,
    platformGrossRevenueDeltaPct: deltaPct(
      grossCents,
      grossFromAggregate(previousEarnings),
    ),
    subscriptionCents: subscriptions._sum.amountCents ?? 0,
    activeBusinesses,
    escrowCents: escrow._sum.amountCents ?? 0,
    escrowOrdersCount: escrow._count._all,
    pendingWithdrawalsCents: pendingWithdrawals._sum.amountCents ?? 0,
    pendingWithdrawalsCount: pendingWithdrawals._count._all,
  });
}

export async function listWithdrawals(
  deps: { db: FinanceDb },
  input: { status?: WithdrawalStatus; cursor?: string },
) {
  const rows = await deps.db.withdrawal.findMany({
    where: input.status ? { status: input.status } : {},
    take: WITHDRAWALS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    // REQUESTED sorts first because the enum declares it first.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      amountCents: true,
      bankName: true,
      accountLast4: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      resolvedAt: true,
      business: { select: { id: true, name: true, status: true } },
    },
  });

  const hasNextPage = rows.length > WITHDRAWALS_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, WITHDRAWALS_PAGE_SIZE) : rows;

  return svcOk({
    items: page.map(({ createdAt, ...withdrawal }) => ({
      ...withdrawal,
      requestedAt: createdAt,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}

export async function getRevenueBreakdown(
  deps: { db: FinanceDb },
  input: { months: number; now?: Date },
): Promise<ServiceResult<RevenueBreakdown>> {
  const now = input.now ?? new Date();
  const current = getFinancialMonthBounds(now);

  // Walk backwards one month at a time so every bucket uses the same calendar
  // helper as the rest of the financial reads.
  const buckets: Array<{ start: Date; end: Date }> = [current];

  for (let index = 1; index < input.months; index += 1) {
    const previousStart = buckets[0];

    if (!previousStart) {
      break;
    }

    buckets.unshift(previousMonthBounds(previousStart.start));
  }

  const firstBucket = buckets[0];
  const lastBucket = buckets.at(-1);

  if (!firstBucket || !lastBucket) {
    return svcFail("CONFLICT", "Invalid revenue window");
  }

  const window = { start: firstBucket.start, end: lastBucket.end };

  const [series, loyaltyPaid, loyaltyPending] = await Promise.all([
    Promise.all(
      buckets.map(async (bucket) => {
        const [earnings, subscriptions] = await Promise.all([
          deps.db.payment.aggregate({
            where: platformEarningWhere(bucket),
            _sum: platformEarningSum,
          }),
          deps.db.invoice.aggregate({
            where: paidInvoiceWhere(bucket),
            _sum: { amountCents: true },
          }),
        ]);

        return {
          month: monthKey(bucket),
          platformGrossRevenueCents: grossFromAggregate(earnings),
          subscriptionCents: subscriptions._sum.amountCents ?? 0,
        };
      }),
    ),
    // Only bonuses actually PAID count as money out; an estimate inside a
    // financial breakdown would be worse than a zero.
    deps.db.loyaltyBonus.aggregate({
      where: {
        status: LoyaltyBonusStatus.PAID,
        paidAt: { gte: window.start, lt: window.end },
      },
      _sum: { amountCents: true },
    }),
    deps.db.loyaltyBonus.aggregate({
      where: { status: LoyaltyBonusStatus.PENDING },
      _sum: { amountCents: true },
    }),
  ]);

  const totalGrossCents = series.reduce(
    (total, bucket) => total + bucket.platformGrossRevenueCents,
    0,
  );
  const totalSubscriptionCents = series.reduce(
    (total, bucket) => total + bucket.subscriptionCents,
    0,
  );
  const loyaltyBonusPaidCents = loyaltyPaid._sum.amountCents ?? 0;

  return svcOk({
    series,
    totals: {
      platformGrossRevenueCents: totalGrossCents,
      subscriptionCents: totalSubscriptionCents,
      loyaltyBonusPaidCents,
      loyaltyBonusPendingCents: loyaltyPending._sum.amountCents ?? 0,
      netRevenueCents: netPlatformRevenueCents({
        platformGrossRevenueCents: totalGrossCents,
        paidSubscriptionCents: totalSubscriptionCents,
        paidLoyaltyBonusCents: loyaltyBonusPaidCents,
      }),
    },
  });
}
