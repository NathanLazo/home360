import "server-only";

import type { PrismaClient } from "../../../../generated/prisma";
import { fail, type TrpcResponse } from "~/server/api/contract";

export type LimitedResource = "branches" | "workers" | "products";

type PlanLimitDatabase = Pick<PrismaClient, "branch" | "worker" | "product">;

export type BusinessWithPlan = {
  id: string;
  subscription: {
    plan: {
      maxBranches: number | null;
      maxWorkers: number | null;
      maxProducts: number | null;
    };
  } | null;
};

function maximumForResource(
  plan: NonNullable<BusinessWithPlan["subscription"]>["plan"],
  resource: LimitedResource,
): number | null {
  switch (resource) {
    case "branches":
      return plan.maxBranches;
    case "workers":
      return plan.maxWorkers;
    case "products":
      return plan.maxProducts;
  }
}

function countResource(
  db: PlanLimitDatabase,
  businessId: string,
  resource: LimitedResource,
): Promise<number> {
  switch (resource) {
    case "branches":
      return db.branch.count({ where: { businessId } });
    case "workers":
      return db.worker.count({ where: { businessId } });
    case "products":
      return db.product.count({
        where: { businessId, status: "PUBLISHED" },
      });
  }
}

export async function assertPlanLimit(
  db: PlanLimitDatabase,
  business: BusinessWithPlan,
  resource: LimitedResource,
): Promise<TrpcResponse<null> | null> {
  if (!business.subscription) {
    return fail("BUSINESS_NOT_ACTIVE", 403, "Business has no active plan");
  }

  const maximum = maximumForResource(business.subscription.plan, resource);

  if (maximum === null) {
    return null;
  }

  const used = await countResource(db, business.id, resource);

  if (used >= maximum) {
    return fail(
      "PLAN_LIMIT_REACHED",
      409,
      `Plan limit reached for ${resource}`,
    );
  }

  return null;
}
