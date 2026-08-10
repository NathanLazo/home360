import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  type PrismaClient,
  SubscriptionStatus,
} from "../../../../generated/prisma";

import type { PlanCode } from "~/lib/subscription/plan-codes";
import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ApproveBusinessErrorCode = "NOT_FOUND" | "CONFLICT";

export type ApproveBusinessDeps = {
  db: PrismaClient;
  /**
   * Injected so the local approval never depends on Stripe being reachable:
   * the billing sync runs after the commit and is idempotent (F4-03).
   */
  ensureBillingSubscription: (input: {
    businessId: string;
  }) => Promise<{ ok: boolean; code?: string }>;
};

function addOneMonth(from: Date): Date {
  const renewsAt = new Date(from);
  renewsAt.setMonth(renewsAt.getMonth() + 1);
  return renewsAt;
}

/**
 * Approving a business is two separate concerns:
 *
 * 1. An atomic local transaction: PENDING → ACTIVE plus its local Subscription.
 * 2. A best-effort, post-commit Stripe Billing sync.
 *
 * A network call inside an interactive Prisma transaction would hold the row
 * lock until timeout and could leave orphan Stripe objects after a rollback,
 * so Stripe is never called inside the commit. No Connect account is created
 * either: the business runs its own onboarding (F3), and a placeholder would
 * permanently hide the W6 onboarding banner.
 */
export async function approveBusiness(
  deps: ApproveBusinessDeps,
  input: { businessId: string; planCode: PlanCode; adminId: string },
): Promise<ServiceResult<{ id: string }, ApproveBusinessErrorCode>> {
  const plan = await deps.db.plan.findUnique({
    where: { code: input.planCode },
    select: { id: true },
  });

  if (!plan) {
    return svcFail("NOT_FOUND", "Plan not found");
  }

  const now = new Date();

  const transactionResult = await deps.db.$transaction(async (tx) => {
    // Conditional update: a concurrent approval leaves count 0 instead of
    // activating twice or creating a second subscription.
    const activated = await tx.business.updateMany({
      where: { id: input.businessId, status: BusinessStatus.PENDING },
      data: { status: BusinessStatus.ACTIVE, statusReason: null },
    });

    if (activated.count === 0) {
      return { activated: false } as const;
    }

    await tx.subscription.create({
      data: {
        businessId: input.businessId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        renewsAt: addOneMonth(now),
      },
    });

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.BUSINESS_APPROVED,
      businessId: input.businessId,
      before: { status: BusinessStatus.PENDING },
      after: { status: BusinessStatus.ACTIVE },
      metadata: { planCode: input.planCode },
    });

    return { activated: true } as const;
  });

  if (!transactionResult.activated) {
    return svcFail("CONFLICT", "Business is not pending approval");
  }

  const billing = await deps.ensureBillingSubscription({
    businessId: input.businessId,
  });

  if (!billing.ok) {
    // The approval already succeeded: a billing failure is observable and
    // repairable by the idempotent ensure* service, never a rollback.
    console.error(
      `[admin] ensureBillingSubscription failed for ${input.businessId}: ${billing.code ?? "UNKNOWN"}`,
    );
  }

  return svcOk({ id: input.businessId });
}
