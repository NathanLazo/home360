import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "../../../../generated/prisma";
import { type PlanCode, planCodeSchema } from "~/lib/subscription/plan-codes";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { ensureBillingSubscription } from "./billing";
import {
  checkDowngradeFit,
  type LimitedResource,
  type PlanLimits,
} from "./plan-limits";

export type ChangePlanDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type ChangePlanErrorCode =
  | "NO_SUBSCRIPTION"
  | "PLAN_NOT_FOUND"
  | "PLAN_NOT_SYNCED"
  | "SAME_PLAN"
  | "SUBSCRIPTION_NOT_ACTIVE"
  | "PLAN_LIMIT_REACHED";

type PreviewErrorCode = Exclude<ChangePlanErrorCode, "PLAN_LIMIT_REACHED">;

export type PlanChangePreview = {
  currentPlanCode: PlanCode;
  targetPlanCode: PlanCode;
  /** Positive = extra charge, negative = credit. Billed on the next invoice. */
  prorationCents: number;
  effectiveAt: Date;
  fits: boolean;
  exceeds: LimitedResource[];
};

type ChangeContext = {
  subscriptionId: string;
  subscriptionUpdatedAt: Date;
  subscriptionStatus: "ACTIVE" | "PAST_DUE" | "CANCELED";
  renewsAt: Date;
  currentPlanCode: PlanCode;
  targetPlanId: string;
  targetPlanCode: PlanCode;
  targetPriceId: string;
  fits: boolean;
  exceeds: LimitedResource[];
};

const PRORATION_BEHAVIOR = "create_prorations" as const;

/**
 * Loads and validates everything both entry points need, so `previewPlanChange`
 * and `changePlan` can never drift apart on which changes are legal.
 */
async function loadChangeContext(
  deps: ChangePlanDeps,
  input: { businessId: string; planCode: PlanCode },
): Promise<ServiceResult<ChangeContext, PreviewErrorCode>> {
  const subscription = await deps.db.subscription.findUnique({
    where: { businessId: input.businessId },
    select: {
      id: true,
      status: true,
      renewsAt: true,
      updatedAt: true,
      planId: true,
      plan: { select: { code: true } },
    },
  });

  if (!subscription) {
    return svcFail("NO_SUBSCRIPTION", "Business has no local subscription");
  }

  // A persisted code outside the catalogue is a data problem, never something
  // to cast away.
  const currentPlanCode = planCodeSchema.safeParse(subscription.plan.code);

  if (!currentPlanCode.success) {
    console.error("[change-plan] UNKNOWN_CURRENT_PLAN_CODE", {
      businessId: input.businessId,
      planCode: subscription.plan.code,
    });

    return svcFail("CONFLICT", "Current plan code is not in the catalogue");
  }

  const targetPlan = await deps.db.plan.findUnique({
    where: { code: input.planCode },
    select: {
      id: true,
      stripePriceId: true,
      maxBranches: true,
      maxWorkers: true,
      maxProducts: true,
    },
  });

  if (!targetPlan) {
    return svcFail("PLAN_NOT_FOUND", "Target plan does not exist");
  }

  if (targetPlan.id === subscription.planId) {
    return svcFail("SAME_PLAN", "Target plan is the current plan");
  }

  if (!targetPlan.stripePriceId) {
    return svcFail("PLAN_NOT_SYNCED", "Target plan has no Stripe price");
  }

  const limits: PlanLimits = {
    maxBranches: targetPlan.maxBranches,
    maxWorkers: targetPlan.maxWorkers,
    maxProducts: targetPlan.maxProducts,
  };

  // Run for every change, up or down: a pricier plan can still be tighter on
  // one resource, so comparing prices to guess the direction would be wrong.
  const fit = await checkDowngradeFit(deps.db, input.businessId, limits);

  return svcOk({
    subscriptionId: subscription.id,
    subscriptionUpdatedAt: subscription.updatedAt,
    subscriptionStatus: subscription.status,
    renewsAt: subscription.renewsAt,
    currentPlanCode: currentPlanCode.data,
    targetPlanId: targetPlan.id,
    targetPlanCode: input.planCode,
    targetPriceId: targetPlan.stripePriceId,
    fits: fit.fits,
    exceeds: fit.exceeds,
  });
}

/**
 * A line is a proration regardless of which parent produced it; the flag moved
 * under `parent` when Stripe restructured invoice lines.
 */
function isProrationLine(line: Stripe.InvoiceLineItem): boolean {
  const parent = line.parent;

  if (!parent) {
    return false;
  }

  return (
    parent.invoice_item_details?.proration === true ||
    parent.subscription_item_details?.proration === true
  );
}

/**
 * Reads the single subscription item. "One plan = one item" is an invariant of
 * the product (F4-03); anything else is a data problem, not a case to guess.
 */
function resolveSingleItemId(
  subscription: Stripe.Subscription,
): ServiceResult<string, never> {
  const items = subscription.items.data;
  const item = items[0];

  if (items.length !== 1 || !item) {
    console.error("[change-plan] UNEXPECTED_ITEM_COUNT", {
      stripeSubscriptionId: subscription.id,
      itemCount: items.length,
    });

    return svcFail("CONFLICT", "Subscription does not have exactly one item");
  }

  return svcOk(item.id);
}

/**
 * Asks Stripe what the change would cost without applying it.
 *
 * With `create_prorations` there is no immediate charge: the adjustment lands on
 * the next invoice, which is what `effectiveAt` dates.
 */
async function computeProration(
  deps: ChangePlanDeps,
  context: ChangeContext,
  businessId: string,
): Promise<
  ServiceResult<{ prorationCents: number; effectiveAt: Date }, PreviewErrorCode>
> {
  const ensured = await ensureBillingSubscription(deps, { businessId });

  if (!ensured.ok) {
    return ensured;
  }

  try {
    const subscription = await deps.stripe.subscriptions.retrieve(
      ensured.data.stripeSubscriptionId,
    );
    const itemId = resolveSingleItemId(subscription);

    if (!itemId.ok) {
      return itemId;
    }

    const preview = await deps.stripe.invoices.createPreview({
      subscription: ensured.data.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: itemId.data, price: context.targetPriceId }],
        proration_behavior: PRORATION_BEHAVIOR,
      },
    });

    if (preview.currency !== "mxn") {
      console.error("[change-plan] UNEXPECTED_PREVIEW_CURRENCY", {
        stripeSubscriptionId: ensured.data.stripeSubscriptionId,
        currency: preview.currency,
      });

      return svcFail("CONFLICT", "Invoice preview is not in MXN");
    }

    // Stripe already returns integer MXN cents; nothing is divided or rounded.
    const prorationCents = preview.lines.data
      .filter(isProrationLine)
      .reduce((total, line) => total + line.amount, 0);

    const previewDate = preview.next_payment_attempt ?? preview.period_end;
    const effectiveAt = previewDate
      ? new Date(previewDate * 1000)
      : context.renewsAt;

    return svcOk({ prorationCents, effectiveAt });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[change-plan] PREVIEW_FAILED", {
        businessId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Invoice preview failed");
    }

    throw error;
  }
}

/**
 * Read-only. Always answers when the plan itself is valid, even if the change
 * does not fit: the dialog needs `exceeds` to explain why it is blocked, and
 * the contract cannot carry that detail inside an error.
 */
export async function previewPlanChange(
  deps: ChangePlanDeps,
  input: { businessId: string; planCode: PlanCode },
): Promise<ServiceResult<PlanChangePreview, PreviewErrorCode>> {
  const context = await loadChangeContext(deps, input);

  if (!context.ok) {
    return context;
  }

  const proration = await computeProration(deps, context.data, input.businessId);

  if (!proration.ok) {
    return proration;
  }

  return svcOk({
    currentPlanCode: context.data.currentPlanCode,
    targetPlanCode: context.data.targetPlanCode,
    prorationCents: proration.data.prorationCents,
    effectiveAt: proration.data.effectiveAt,
    fits: context.data.fits,
    exceeds: context.data.exceeds,
  });
}

/**
 * Applies the plan change on Stripe and converges the local row.
 *
 * Commission is not recalculated for existing payments: `commissionPctApplied`
 * was frozen at capture time (F3-03). Only future payments use the new plan
 * percentage.
 */
export async function changePlan(
  deps: ChangePlanDeps,
  input: { businessId: string; planCode: PlanCode },
): Promise<
  ServiceResult<
    { planCode: PlanCode; prorationCents: number },
    ChangePlanErrorCode
  >
> {
  const loaded = await loadChangeContext(deps, input);

  if (!loaded.ok) {
    return loaded;
  }

  const context = loaded.data;

  if (context.subscriptionStatus === "CANCELED") {
    return svcFail("SUBSCRIPTION_NOT_ACTIVE", "Subscription is canceled");
  }

  // Server-side re-validation: a change that does not fit never reaches Stripe.
  if (!context.fits) {
    return svcFail("PLAN_LIMIT_REACHED", context.exceeds.join(","));
  }

  const proration = await computeProration(deps, context, input.businessId);

  if (!proration.ok) {
    return proration;
  }

  const ensured = await ensureBillingSubscription(deps, {
    businessId: input.businessId,
  });

  if (!ensured.ok) {
    return ensured;
  }

  try {
    const subscription = await deps.stripe.subscriptions.retrieve(
      ensured.data.stripeSubscriptionId,
    );
    const itemId = resolveSingleItemId(subscription);

    if (!itemId.ok) {
      return itemId;
    }

    const currentPriceId = subscription.items.data[0]?.price.id;

    // Retry after a lost response, or a webhook that already applied it: do not
    // create a second round of prorations, just converge the local row.
    if (currentPriceId !== context.targetPriceId) {
      await deps.stripe.subscriptions.update(
        ensured.data.stripeSubscriptionId,
        {
          items: [{ id: itemId.data, price: context.targetPriceId }],
          proration_behavior: PRORATION_BEHAVIOR,
          metadata: {
            businessId: input.businessId,
            planCode: context.targetPlanCode,
          },
        },
        {
          // Versioned by the local row: two concurrent requests from the same
          // version share the key, while a later A→B after B→A gets a new one
          // and never recycles a historical Stripe response.
          idempotencyKey: `change-plan-${context.subscriptionId}-${context.subscriptionUpdatedAt.getTime()}-${context.targetPlanId}`,
        },
      );
    }

    // Compare-and-set on the version we loaded. The `customer.subscription.updated`
    // webhook writes the same thing absolutely, so both paths converge.
    const written = await deps.db.subscription.updateMany({
      where: {
        id: context.subscriptionId,
        updatedAt: context.subscriptionUpdatedAt,
      },
      data: { planId: context.targetPlanId },
    });

    if (written.count === 0) {
      console.warn("[change-plan] LOST_WRITE_RACE", {
        businessId: input.businessId,
        subscriptionId: context.subscriptionId,
      });
    }

    return svcOk({
      planCode: context.targetPlanCode,
      prorationCents: proration.data.prorationCents,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[change-plan] UPDATE_FAILED", {
        businessId: input.businessId,
        code: error.code,
      });

      return svcFail("STRIPE_ERROR", "Stripe subscription update failed");
    }

    throw error;
  }
}
