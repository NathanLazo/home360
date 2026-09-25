import "server-only";

import { WithdrawalStatus, type PrismaClient } from "@generated/prisma";

import { getBusinessBalances } from "../payments/balances";
import { PLATFORM_EARNING_PAYMENT_STATUSES } from "../payments/financial-projections";
import { svcFail, svcOk } from "../service-result";
import { boundsForMonth } from "./month-bounds";

/**
 * Admin-side financial file of a single business (W9/W12 gap the assistant
 * fills): what the platform owes it, what it sold in the month and where a
 * payout would land. Read-only; approvals stay in the withdrawal service.
 */
export async function getBusinessFinance(
  deps: { db: PrismaClient },
  input: { businessId: string; month?: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const month = boundsForMonth(input.month, now);

  if (!month) {
    return svcFail("CONFLICT", "Invalid month");
  }

  const business = await deps.db.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      name: true,
      status: true,
      stripeAccountId: true,
      payoutsEnabled: true,
      chargesEnabled: true,
      owner: { select: { name: true, email: true } },
      subscription: {
        select: {
          status: true,
          plan: { select: { code: true, name: true, commissionPct: true } },
        },
      },
    },
  });

  if (!business) {
    return svcFail("NOT_FOUND");
  }

  const [balances, monthSales, pendingWithdrawals, lastPayout] =
    await Promise.all([
      getBusinessBalances({ db: deps.db }, { businessId: business.id, now }),
      deps.db.payment.aggregate({
        where: {
          businessId: business.id,
          status: { in: [...PLATFORM_EARNING_PAYMENT_STATUSES] },
          createdAt: { gte: month.start, lt: month.end },
        },
        _count: { _all: true },
        _sum: {
          amountCents: true,
          providerAmountCents: true,
          commissionCents: true,
          refundedCents: true,
        },
      }),
      deps.db.withdrawal.findMany({
        where: { businessId: business.id, status: WithdrawalStatus.REQUESTED },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amountCents: true,
          bankName: true,
          accountLast4: true,
          createdAt: true,
        },
      }),
      deps.db.withdrawal.findFirst({
        where: { businessId: business.id, status: WithdrawalStatus.APPROVED },
        orderBy: { resolvedAt: "desc" },
        select: { id: true, amountCents: true, resolvedAt: true },
      }),
    ]);

  if (!balances.ok) {
    return svcFail(balances.code, balances.detail);
  }

  return svcOk({
    business: {
      id: business.id,
      name: business.name,
      status: business.status,
      ownerName: business.owner.name,
      ownerEmail: business.owner.email,
      plan: business.subscription?.plan ?? null,
      subscriptionStatus: business.subscription?.status ?? null,
      // A payout can only be executed to its connected Stripe account.
      hasStripeAccount: business.stripeAccountId !== null,
      payoutsEnabled: business.payoutsEnabled,
      chargesEnabled: business.chargesEnabled,
    },
    balances: balances.data,
    month: month.start.toISOString().slice(0, 7),
    monthSales: {
      paymentsCount: monthSales._count._all,
      grossCents: monthSales._sum.amountCents ?? 0,
      providerCents: monthSales._sum.providerAmountCents ?? 0,
      commissionCents: monthSales._sum.commissionCents ?? 0,
      refundedCents: monthSales._sum.refundedCents ?? 0,
    },
    pendingWithdrawals: pendingWithdrawals.map(
      ({ createdAt, ...withdrawal }) => ({
        ...withdrawal,
        requestedAt: createdAt,
      }),
    ),
    lastApprovedWithdrawal: lastPayout,
  });
}

/**
 * Full withdrawal file: destination account snapshot, Stripe payout state,
 * business payout readiness and the receipts already registered against it.
 */
export async function getWithdrawalDetail(
  deps: { db: PrismaClient },
  input: { withdrawalId: string },
) {
  const withdrawal = await deps.db.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: {
      id: true,
      amountCents: true,
      bankName: true,
      accountLast4: true,
      status: true,
      rejectionReason: true,
      payoutStripeAccountId: true,
      stripePayoutId: true,
      createdAt: true,
      resolvedAt: true,
      business: {
        select: {
          id: true,
          name: true,
          status: true,
          stripeAccountId: true,
          payoutsEnabled: true,
        },
      },
      receipts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          contentType: true,
          sizeBytes: true,
          notes: true,
          createdAt: true,
          uploadedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!withdrawal) {
    return svcFail("NOT_FOUND");
  }

  const { createdAt, business, receipts, ...rest } = withdrawal;

  return svcOk({
    ...rest,
    requestedAt: createdAt,
    business: {
      id: business.id,
      name: business.name,
      status: business.status,
      hasStripeAccount: business.stripeAccountId !== null,
      payoutsEnabled: business.payoutsEnabled,
    },
    receipts: receipts.map(({ uploadedBy, ...receipt }) => ({
      ...receipt,
      uploadedByName: uploadedBy.name,
    })),
  });
}
