import {
  type BusinessType,
  BusinessStatus,
  type DisputeStatus,
  type DisputeUrgency,
  type GuaranteeType,
  type PrismaClient,
  UserRole,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { getFinancialMonthBounds } from "../payments/balances";
import { boundsForMonth, previousMonthBounds } from "./month-bounds";
import {
  CHARGED_PAYMENT_STATUSES,
  ESCROW_PAYMENT_STATUSES,
} from "../payments/financial-projections";

type OverviewDb = Pick<
  PrismaClient,
  "business" | "dispute" | "payment" | "platformSettings" | "user"
>;

/** Platform users exclude the internal admin team (F5-18). */
const PLATFORM_USER_ROLES = [
  UserRole.BUSINESS,
  UserRole.CUSTOMER,
  UserRole.WORKER,
] as const;

export interface PlatformKpis {
  /** "YYYY-MM" of the reported month (platform financial calendar). */
  month: string;
  /** "YYYY-MM" of the month in course, upper bound of the month selector. */
  currentMonth: string;
  totalUsers: number;
  newUsersMonth: number;
  activeBusinesses: number;
  pendingBusinesses: number;
  gmvCents: number;
  gmvDeltaPct: number | null;
  escrowCents: number;
  escrowOrdersCount: number;
}

export interface PendingBusinessSummary {
  id: string;
  name: string;
  type: BusinessType;
  guaranteeType: GuaranteeType;
  createdAt: Date;
}

export interface OpenDisputeSummary {
  id: string;
  title: string;
  urgency: DisputeUrgency;
  status: DisputeStatus;
  businessName: string;
  customerName: string | null;
  escrowCents: number;
  /** D6 evidence the admin reviews before deciding (W9 quick actions). */
  hasRecording: boolean;
  recordingComplete: boolean;
  evidenceCount: number;
  createdAt: Date;
}

export interface AiConfigSummary {
  confidenceThresholdPct: number;
  pricingModel: string;
  humanReviewBelowThreshold: boolean;
  updatedAt: Date;
}

/**
 * Local midnight in the platform's (negative-offset) financial time zone is
 * still the first day of the month in UTC, mirroring the finance KPIs key.
 */
function monthKey(start: Date): string {
  return start.toISOString().slice(0, 7);
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export async function getPlatformKpis(
  deps: { db: OverviewDb },
  input: { now?: Date; month?: string } = {},
): Promise<ServiceResult<PlatformKpis>> {
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    return svcFail("CONFLICT", "Invalid KPI cutoff date");
  }

  const month = boundsForMonth(input.month, now);

  if (!month) {
    return svcFail("CONFLICT", "Invalid KPI month");
  }

  const previous = previousMonthBounds(month.start);
  const platformUserFilter = { role: { in: [...PLATFORM_USER_ROLES] } };

  const [
    totalUsers,
    newUsersMonth,
    activeBusinesses,
    pendingBusinesses,
    monthGmv,
    previousGmv,
    escrow,
  ] = await Promise.all([
    // Platform size as of the end of the reported month.
    deps.db.user.count({
      where: { ...platformUserFilter, createdAt: { lt: month.end } },
    }),
    deps.db.user.count({
      where: {
        ...platformUserFilter,
        createdAt: { gte: month.start, lt: month.end },
      },
    }),
    deps.db.business.count({ where: { status: BusinessStatus.ACTIVE } }),
    deps.db.business.count({ where: { status: BusinessStatus.PENDING } }),
    // GMV: total effectively charged in the month, gross of refunds, bucketed
    // by `Payment.createdAt` (charge time, XC-27). The UI shows the gross
    // figure; a net view must expose `refundedCents` separately.
    deps.db.payment.aggregate({
      where: {
        status: { in: [...CHARGED_PAYMENT_STATUSES] },
        createdAt: { gte: month.start, lt: month.end },
      },
      _sum: { amountCents: true },
    }),
    deps.db.payment.aggregate({
      where: {
        status: { in: [...CHARGED_PAYMENT_STATUSES] },
        createdAt: { gte: previous.start, lt: previous.end },
      },
      _sum: { amountCents: true },
    }),
    deps.db.payment.aggregate({
      where: { status: { in: [...ESCROW_PAYMENT_STATUSES] } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const gmvCents = monthGmv._sum.amountCents ?? 0;
  const previousGmvCents = previousGmv._sum.amountCents ?? 0;

  return svcOk({
    month: monthKey(month.start),
    currentMonth: monthKey(getFinancialMonthBounds(now).start),
    totalUsers,
    newUsersMonth,
    activeBusinesses,
    pendingBusinesses,
    gmvCents,
    gmvDeltaPct: deltaPct(gmvCents, previousGmvCents),
    escrowCents: escrow._sum.amountCents ?? 0,
    escrowOrdersCount: escrow._count._all,
  });
}

export async function getPendingBusinesses(
  deps: { db: OverviewDb },
  input: { take?: number } = {},
): Promise<ServiceResult<PendingBusinessSummary[]>> {
  const businesses = await deps.db.business.findMany({
    where: { status: BusinessStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: input.take ?? 5,
    select: {
      id: true,
      name: true,
      type: true,
      guaranteeType: true,
      createdAt: true,
    },
  });

  return svcOk(businesses);
}

export async function getOpenDisputes(
  deps: { db: OverviewDb },
  input: { statuses: readonly DisputeStatus[]; take?: number },
): Promise<ServiceResult<OpenDisputeSummary[]>> {
  const disputes = await deps.db.dispute.findMany({
    where: { status: { in: [...input.statuses] } },
    // URGENT sorts before NORMAL because the enum is declared NORMAL, URGENT.
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
    take: input.take ?? 3,
    select: {
      id: true,
      title: true,
      urgency: true,
      status: true,
      evidenceUrls: true,
      createdAt: true,
      business: { select: { name: true } },
      order: {
        select: {
          recordingUrl: true,
          recordingComplete: true,
          customer: { select: { name: true } },
          payment: { select: { amountCents: true } },
        },
      },
    },
  });

  return svcOk(
    disputes.map((dispute) => ({
      id: dispute.id,
      title: dispute.title,
      urgency: dispute.urgency,
      status: dispute.status,
      businessName: dispute.business.name,
      customerName: dispute.order.customer.name,
      escrowCents: dispute.order.payment?.amountCents ?? 0,
      hasRecording: dispute.order.recordingUrl !== null,
      recordingComplete: dispute.order.recordingComplete,
      evidenceCount: dispute.evidenceUrls.length,
      createdAt: dispute.createdAt,
    })),
  );
}

export async function getAiConfigSummary(deps: {
  db: OverviewDb;
}): Promise<ServiceResult<AiConfigSummary>> {
  const settings = await deps.db.platformSettings.findFirst({
    select: {
      aiConfidenceThresholdPct: true,
      aiPricingModel: true,
      aiHumanReviewBelowThreshold: true,
      updatedAt: true,
    },
  });

  if (!settings) {
    return svcFail("NOT_FOUND", "Platform settings singleton is missing");
  }

  return svcOk({
    confidenceThresholdPct: settings.aiConfidenceThresholdPct,
    pricingModel: settings.aiPricingModel,
    humanReviewBelowThreshold: settings.aiHumanReviewBelowThreshold,
    updatedAt: settings.updatedAt,
  });
}
