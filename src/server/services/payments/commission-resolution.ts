import "server-only";

import {
  CommissionSource,
  CorporateStatus,
  SubscriptionStatus,
  type Payment,
  type PrismaClient,
} from "../../../../generated/prisma";

import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

/**
 * Commission contract frozen on every `Payment` at capture (XC-26).
 *
 * `effectivePct` governs transfers, loyalty bonuses and real platform income;
 * `providerPlanPct` is the reference the provider plan alone would have
 * charged. Both are resolved in the same operation so the audit comparison
 * survives later plan or corporate-term renegotiations.
 */
export type CommissionResolution = {
  effectivePct: number;
  providerPlanPct: number;
  source: CommissionSource;
};

type CommissionDb = Pick<PrismaClient, "business" | "corporateAccount">;

export type CommissionResolutionErrorCode = "BUSINESS_NOT_ACTIVE";

function isValidCommissionPct(pct: number): boolean {
  return Number.isInteger(pct) && pct >= 0 && pct <= 100;
}

/**
 * Resolves the effective commission and the provider-plan reference for a
 * capture.
 *
 * Rules (XC-26):
 * 1. The provider plan is always resolved first and its percentage frozen as
 *    the reference, regardless of the corporate branch.
 * 2. Only an `ACTIVE` corporate account contributes a preferential
 *    percentage; `PENDING`/`SUSPENDED`/`CANCELLED` or missing accounts fall
 *    back to the provider plan on both sides.
 */
export async function resolveCommissionPct(
  db: CommissionDb,
  input: { businessId: string; corporateAccountId: string | null },
): Promise<ServiceResult<CommissionResolution, CommissionResolutionErrorCode>> {
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: {
      subscription: {
        select: {
          status: true,
          plan: { select: { commissionPct: true } },
        },
      },
    },
  });
  const subscription = business?.subscription;

  if (subscription?.status !== SubscriptionStatus.ACTIVE) {
    return svcFail("BUSINESS_NOT_ACTIVE");
  }

  const providerPlanPct = subscription.plan.commissionPct;

  if (!isValidCommissionPct(providerPlanPct)) {
    return svcFail("CONFLICT", "Invalid plan commission configuration");
  }

  if (input.corporateAccountId !== null) {
    const corporateAccount = await db.corporateAccount.findUnique({
      where: { id: input.corporateAccountId },
      select: { status: true, commissionPct: true },
    });

    if (corporateAccount?.status === CorporateStatus.ACTIVE) {
      if (!isValidCommissionPct(corporateAccount.commissionPct)) {
        return svcFail(
          "CONFLICT",
          "Invalid corporate commission configuration",
        );
      }

      return svcOk({
        effectivePct: corporateAccount.commissionPct,
        providerPlanPct,
        source: CommissionSource.CORPORATE_ACCOUNT,
      });
    }
    // Non-ACTIVE or missing account: no preferential commission, both
    // percentages come from the provider plan.
  }

  return svcOk({
    effectivePct: providerPlanPct,
    providerPlanPct,
    source: CommissionSource.PROVIDER_PLAN,
  });
}

/**
 * Commission amount over the XC-25 principal (`providerAmountCents`). Both the
 * effective and the reference commission use this same base — never the flat
 * service fee nor the ambiguous charged total.
 */
export function commissionCentsOnPrincipal(
  providerAmountCents: number,
  commissionPct: number,
): number {
  return Math.round((providerAmountCents * commissionPct) / 100);
}

export type CommissionReferenceLedger = Pick<
  Payment,
  "providerPlanCommissionCents" | "commissionCents"
>;

/**
 * Savings produced by a preferential commission, from frozen snapshots only.
 * F7-05 aggregates this over eligible corporate payments; it never consults
 * the current plan or tier.
 */
export function savedByRateCents(payment: CommissionReferenceLedger): number {
  return Math.max(
    0,
    payment.providerPlanCommissionCents - payment.commissionCents,
  );
}
