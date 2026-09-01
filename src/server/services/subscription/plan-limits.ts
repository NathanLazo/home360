import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { fail, type TrpcResponse } from "~/server/api/contract";

export const LIMITED_RESOURCES = ["branches", "workers", "products"] as const;

export type LimitedResource = (typeof LIMITED_RESOURCES)[number];

type PlanLimitDatabase = Pick<PrismaClient, "branch" | "worker" | "product">;

export type PlanLimits = {
  maxBranches: number | null;
  maxWorkers: number | null;
  maxProducts: number | null;
};

/**
 * Flattened business shape produced by `businessProcedure` (F0-05). Services
 * receive the plan already resolved; they never re-read the subscription.
 */
export type BusinessWithPlan = {
  id: string;
  plan: PlanLimits | null;
};

export type PlanUsage = Record<LimitedResource, number>;

export type PlanUsageReport = Record<
  LimitedResource,
  { used: number; max: number | null }
>;

/**
 * Single definition of what each limited resource means: the maximum allowed by
 * a plan and the rows that count against it. Every limit check reads from here
 * so a filter can never drift between "can I add one more" and "does my usage
 * fit this plan".
 */
const RESOURCE_DEFINITIONS: Record<
  LimitedResource,
  {
    maximum: (plan: PlanLimits) => number | null;
    count: (db: PlanLimitDatabase, businessId: string) => Promise<number>;
  }
> = {
  branches: {
    maximum: (plan) => plan.maxBranches,
    count: (db, businessId) => db.branch.count({ where: { businessId } }),
  },
  workers: {
    maximum: (plan) => plan.maxWorkers,
    count: (db, businessId) => db.worker.count({ where: { businessId } }),
  },
  products: {
    maximum: (plan) => plan.maxProducts,
    count: (db, businessId) =>
      db.product.count({ where: { businessId, status: "PUBLISHED" } }),
  },
};

/**
 * Guards the creation of one more row of `resource`.
 *
 * Fails at `used >= max` because the caller is about to add another one. This
 * is deliberately stricter than `checkDowngradeFit`, which only rejects usage
 * that already exceeds the target plan (`used > max`).
 */
export async function assertPlanLimit(
  db: PlanLimitDatabase,
  business: BusinessWithPlan,
  resource: LimitedResource,
): Promise<TrpcResponse<null> | null> {
  if (!business.plan) {
    return fail("BUSINESS_NOT_ACTIVE", 403, "Business has no active plan");
  }

  const definition = RESOURCE_DEFINITIONS[resource];
  const maximum = definition.maximum(business.plan);

  // `null` is unlimited: skip the query entirely.
  if (maximum === null) {
    return null;
  }

  const used = await definition.count(db, business.id);

  if (used >= maximum) {
    return fail(
      "PLAN_LIMIT_REACHED",
      409,
      `Plan limit reached for ${resource}`,
    );
  }

  return null;
}

/**
 * Counts every limited resource of a business in a single round of queries.
 */
export async function getPlanUsage(
  db: PlanLimitDatabase,
  businessId: string,
): Promise<PlanUsage> {
  const [branches, workers, products] = await Promise.all(
    LIMITED_RESOURCES.map((resource) =>
      RESOURCE_DEFINITIONS[resource].count(db, businessId),
    ),
  );

  return {
    branches: branches ?? 0,
    workers: workers ?? 0,
    products: products ?? 0,
  };
}

/**
 * Read-only check run before a plan change. Never throws and never calls
 * Stripe: the dialog needs the detail even when the change is impossible.
 */
export async function checkDowngradeFit(
  db: PlanLimitDatabase,
  businessId: string,
  targetPlan: PlanLimits,
): Promise<{ fits: boolean; exceeds: LimitedResource[]; usage: PlanUsage }> {
  const usage = await getPlanUsage(db, businessId);
  const exceeds = LIMITED_RESOURCES.filter((resource) => {
    const maximum = RESOURCE_DEFINITIONS[resource].maximum(targetPlan);

    return maximum !== null && usage[resource] > maximum;
  });

  return { fits: exceeds.length === 0, exceeds, usage };
}

/**
 * Pairs usage with the plan maximum for `subscription.getCurrent`. `max: null`
 * stays null; only the UI translates it to "unlimited".
 */
export function buildPlanUsageReport(
  usage: PlanUsage,
  plan: PlanLimits,
): PlanUsageReport {
  return {
    branches: { used: usage.branches, max: plan.maxBranches },
    workers: { used: usage.workers, max: plan.maxWorkers },
    products: { used: usage.products, max: plan.maxProducts },
  };
}
