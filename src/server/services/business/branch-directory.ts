import "server-only";

import {
  Prisma,
  type BranchStatus,
  type PrismaClient,
} from "../../../../generated/prisma";
import type {
  BranchCreateInput,
  BranchSetStatusInput,
  BranchUpdateInput,
} from "~/app/[locale]/dashboard/branches/_components/branch.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { ACTIVE_ORDER_STATUSES } from "~/server/services/business/order-activity";
import {
  assertPlanLimit,
  type BusinessWithPlan,
} from "~/server/services/subscription/plan-limits";

const branchListSelect = {
  id: true,
  name: true,
  address: true,
  managerName: true,
  status: true,
  coverageRadiusKm: true,
} satisfies Prisma.BranchSelect;

const MAX_SERIALIZABLE_ATTEMPTS = 3;

type BranchListPayload = Prisma.BranchGetPayload<{
  select: typeof branchListSelect;
}>;

export type BranchListItem = BranchListPayload & {
  monthlyOrders: number;
};

type BranchListResult = {
  items: BranchListItem[];
  limits: { used: number; max: number | null };
};

function startOfCurrentMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function listBranches(
  db: PrismaClient,
  business: BusinessWithPlan,
  now = new Date(),
): Promise<TrpcResponse<BranchListResult>> {
  if (!business.plan) {
    return fail("BUSINESS_NOT_ACTIVE", 403, "Business has no active plan");
  }

  const branches = await db.branch.findMany({
    where: { businessId: business.id },
    select: branchListSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const branchIds = branches.map(({ id }) => id);
  const monthlyOrderGroups =
    branchIds.length === 0
      ? []
      : await db.order.groupBy({
          by: ["branchId"],
          where: {
            businessId: business.id,
            branchId: { in: branchIds },
            // W8 uses the current server-calendar month, not W3's rolling window.
            createdAt: { gte: startOfCurrentMonth(now), lte: now },
          },
          _count: { _all: true },
        });
  const monthlyOrdersByBranch = new Map(
    monthlyOrderGroups.map((group) => [group.branchId, group._count._all]),
  );

  return ok(
    {
      items: branches.map((branch) => ({
        ...branch,
        monthlyOrders: monthlyOrdersByBranch.get(branch.id) ?? 0,
      })),
      limits: {
        used: branches.length,
        max: business.plan.maxBranches,
      },
    },
    "Branches loaded",
  );
}

export async function createBranch(
  db: PrismaClient,
  business: BusinessWithPlan,
  input: BranchCreateInput,
): Promise<TrpcResponse<{ id: string }>> {
  for (
    let transactionAttempt = 0;
    transactionAttempt < MAX_SERIALIZABLE_ATTEMPTS;
    transactionAttempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          const limitFailure = await assertPlanLimit(tx, business, "branches");

          if (limitFailure) {
            return fail(
              limitFailure.error ?? "PLAN_LIMIT_REACHED",
              limitFailure.status,
              limitFailure.message,
            );
          }

          const branch = await tx.branch.create({
            data: {
              businessId: business.id,
              name: input.name,
              address: input.address,
              managerName: input.managerName,
              coverageRadiusKm: input.coverageRadiusKm,
            },
            select: { id: true },
          });

          return ok(branch, "Branch created", 201);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }
    }
  }

  return fail("CONFLICT", 409, "Branch creation conflicted; try again");
}

export async function updateBranch(
  db: PrismaClient,
  businessId: string,
  input: BranchUpdateInput,
): Promise<TrpcResponse<{ id: string }>> {
  try {
    const branch = await db.branch.update({
      where: { id: input.id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.managerName !== undefined
          ? { managerName: input.managerName }
          : {}),
        ...(input.coverageRadiusKm !== undefined
          ? { coverageRadiusKm: input.coverageRadiusKm }
          : {}),
      },
      select: { id: true },
    });

    return ok(branch, "Branch updated");
  } catch (error) {
    if (isRecordNotFound(error)) {
      return fail("NOT_FOUND", 404, "Branch not found");
    }

    throw error;
  }
}

export async function setBranchStatus(
  db: PrismaClient,
  businessId: string,
  input: BranchSetStatusInput,
): Promise<TrpcResponse<{ id: string; status: BranchStatus }>> {
  try {
    const branch = await db.branch.update({
      where: { id: input.id, businessId },
      data: { status: input.status },
      select: { id: true, status: true },
    });

    return ok(branch, "Branch status updated");
  } catch (error) {
    if (isRecordNotFound(error)) {
      return fail("NOT_FOUND", 404, "Branch not found");
    }

    throw error;
  }
}

export async function deleteBranch(
  db: PrismaClient,
  businessId: string,
  id: string,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!branch) {
      return fail("NOT_FOUND", 404, "Branch not found");
    }

    const activeOrders = await tx.order.count({
      where: {
        businessId,
        branchId: id,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
    });

    if (activeOrders > 0) {
      return fail("CONFLICT", 409, "Branch has active orders");
    }

    await tx.branch.delete({ where: { id, businessId } });

    return ok({ id }, "Branch deleted");
  });
}
