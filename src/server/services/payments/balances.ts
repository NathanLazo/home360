import {
  LoyaltyBonusStatus,
  type PrismaClient,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  AVAILABLE_BALANCE_PAYMENT_STATUSES,
  ESCROW_PAYMENT_STATUSES,
  PLATFORM_EARNING_PAYMENT_STATUSES,
  RESERVED_WITHDRAWAL_STATUSES,
  availableBalanceCents,
} from "./financial-projections";

export const FINANCIAL_TIME_ZONE = "America/Chihuahua";

type BalancesDb = Pick<PrismaClient, "loyaltyBonus" | "payment" | "withdrawal">;

export interface BusinessBalances {
  availableCents: number;
  escrowCents: number;
  escrowOrdersCount: number;
  monthCommissionCents: number;
  loyaltyPendingCents: number;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const financialDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FINANCIAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getCalendarParts(date: Date): CalendarParts {
  const parts = Object.fromEntries(
    financialDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year ?? Number.NaN,
    month: parts.month ?? Number.NaN,
    day: parts.day ?? Number.NaN,
    hour: parts.hour ?? Number.NaN,
    minute: parts.minute ?? Number.NaN,
    second: parts.second ?? Number.NaN,
  };
}

function calendarPartsAsUtc(parts: CalendarParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function zonedMidnightAsUtc(year: number, month: number): Date {
  const targetParts: CalendarParts = {
    year,
    month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  };
  const targetEpoch = calendarPartsAsUtc(targetParts);
  let instantEpoch = targetEpoch;

  // Resolve the IANA-zone offset at the target local time without depending on
  // the server's local timezone. Repeating also covers offset transitions.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observedEpoch = calendarPartsAsUtc(
      getCalendarParts(new Date(instantEpoch)),
    );
    instantEpoch += targetEpoch - observedEpoch;
  }

  return new Date(instantEpoch);
}

export function getFinancialMonthBounds(now: Date): {
  start: Date;
  end: Date;
} {
  const { year, month } = getCalendarParts(now);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;

  return {
    start: zonedMidnightAsUtc(year, month),
    end: zonedMidnightAsUtc(nextMonthYear, nextMonth),
  };
}

export async function getBusinessBalances(
  deps: { db: BalancesDb },
  input: { businessId: string; now?: Date },
): Promise<ServiceResult<BusinessBalances>> {
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    return svcFail("CONFLICT", "Invalid balance cutoff date");
  }

  const month = getFinancialMonthBounds(now);

  const [
    releasedPayments,
    reservedWithdrawals,
    escrowPayments,
    monthCommission,
    pendingLoyalty,
  ] = await Promise.all([
    deps.db.payment.aggregate({
      where: {
        businessId: input.businessId,
        status: { in: [...AVAILABLE_BALANCE_PAYMENT_STATUSES] },
      },
      _sum: {
        providerAmountCents: true,
        providerRefundedCents: true,
        commissionCents: true,
      },
    }),
    deps.db.withdrawal.aggregate({
      where: {
        businessId: input.businessId,
        status: { in: [...RESERVED_WITHDRAWAL_STATUSES] },
      },
      _sum: { amountCents: true },
    }),
    // Escrow shows the total charged amount; the provider net share is not a
    // business balance (the retained flat fee is platform revenue).
    deps.db.payment.aggregate({
      where: {
        businessId: input.businessId,
        status: { in: [...ESCROW_PAYMENT_STATUSES] },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    // Month commission buckets by `Payment.createdAt` (charge time, XC-27).
    deps.db.payment.aggregate({
      where: {
        businessId: input.businessId,
        status: { in: [...PLATFORM_EARNING_PAYMENT_STATUSES] },
        createdAt: { gte: month.start, lt: month.end },
      },
      _sum: { commissionCents: true },
    }),
    deps.db.loyaltyBonus.aggregate({
      where: {
        businessId: input.businessId,
        status: LoyaltyBonusStatus.PENDING,
      },
      _sum: { amountCents: true },
    }),
  ]);

  const availableCents = availableBalanceCents({
    releasedLedger: {
      providerAmountCents: releasedPayments._sum.providerAmountCents ?? 0,
      providerRefundedCents: releasedPayments._sum.providerRefundedCents ?? 0,
      commissionCents: releasedPayments._sum.commissionCents ?? 0,
    },
    reservedWithdrawalCents: reservedWithdrawals._sum.amountCents ?? 0,
  });

  return svcOk({
    availableCents,
    escrowCents: escrowPayments._sum.amountCents ?? 0,
    escrowOrdersCount: escrowPayments._count._all,
    monthCommissionCents: monthCommission._sum.commissionCents ?? 0,
    loyaltyPendingCents: pendingLoyalty._sum.amountCents ?? 0,
  });
}
