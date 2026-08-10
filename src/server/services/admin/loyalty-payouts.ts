import "server-only";

import {
  AdminAuditAction,
  LoyaltyBonusStatus,
  type LoyaltyPayoutMethod,
  type PrismaClient,
} from "../../../../generated/prisma";

import { writeAdminAudit } from "./admin-audit";

import { LOYALTY_BONUSES_PAGE_SIZE } from "~/app/[locale]/admin/finance/_components/finance.schema";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

type LoyaltyDb = Pick<PrismaClient, "loyaltyBonus" | "$transaction">;

/**
 * A loyalty bonus is not a withdrawal: it never leaves the escrow balance and
 * never goes through Stripe Connect. It is settled outside the platform (fuel
 * or grocery vouchers, or a direct transfer) and the system only records that
 * settlement.
 */
export async function listLoyaltyBonuses(
  deps: { db: LoyaltyDb },
  input: {
    status?: LoyaltyBonusStatus;
    businessId?: string;
    cursor?: string;
  },
) {
  const rows = await deps.db.loyaltyBonus.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      // An administrative filter, not a tenant scope.
      ...(input.businessId ? { businessId: input.businessId } : {}),
    },
    take: LOYALTY_BONUSES_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      amountCents: true,
      pctApplied: true,
      status: true,
      method: true,
      paidAt: true,
      notes: true,
      createdAt: true,
      business: { select: { id: true, name: true } },
      payment: { select: { id: true, amountCents: true, releasedAt: true } },
    },
  });

  const hasNextPage = rows.length > LOYALTY_BONUSES_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, LOYALTY_BONUSES_PAGE_SIZE) : rows;

  return svcOk({
    items: page,
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}

export async function payLoyaltyBonus(
  deps: { db: LoyaltyDb },
  input: {
    bonusId: string;
    method: LoyaltyPayoutMethod;
    notes?: string;
    adminId: string;
  },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const applied = await deps.db.$transaction(async (tx) => {
    // Conditional gate so two admins cannot settle the same bonus twice.
    const paid = await tx.loyaltyBonus.updateMany({
      where: { id: input.bonusId, status: LoyaltyBonusStatus.PENDING },
      data: {
        status: LoyaltyBonusStatus.PAID,
        method: input.method,
        paidAt: new Date(),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    if (paid.count === 0) {
      return null;
    }

    const bonus = await tx.loyaltyBonus.findUnique({
      where: { id: input.bonusId },
      select: { amountCents: true },
    });

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.LOYALTY_BONUS_PAID,
      bonusId: input.bonusId,
      metadata: {
        amountCents: bonus?.amountCents ?? 0,
        method: input.method,
        reasonPresent: Boolean(input.notes),
      },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Bonus is not pending");
  }

  return svcOk({ id: input.bonusId });
}

export async function cancelLoyaltyBonus(
  deps: { db: LoyaltyDb },
  input: { bonusId: string; reason: string; adminId: string },
): Promise<ServiceResult<{ id: string }, "CONFLICT">> {
  const applied = await deps.db.$transaction(async (tx) => {
    const cancelled = await tx.loyaltyBonus.updateMany({
      where: { id: input.bonusId, status: LoyaltyBonusStatus.PENDING },
      data: { status: LoyaltyBonusStatus.CANCELLED, notes: input.reason },
    });

    if (cancelled.count === 0) {
      return null;
    }

    const bonus = await tx.loyaltyBonus.findUnique({
      where: { id: input.bonusId },
      select: { amountCents: true },
    });

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.LOYALTY_BONUS_CANCELLED,
      bonusId: input.bonusId,
      metadata: {
        amountCents: bonus?.amountCents ?? 0,
        method: null,
        reasonPresent: true,
      },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Bonus is not pending");
  }

  return svcOk({ id: input.bonusId });
}
