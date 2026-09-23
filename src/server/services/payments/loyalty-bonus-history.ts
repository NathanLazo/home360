import "server-only";

import type {
  LoyaltyBonusStatus,
  LoyaltyPayoutMethod,
  PrismaClient,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";

export const BUSINESS_LOYALTY_BONUSES_PAGE_SIZE = 20;

type LoyaltyHistoryDb = Pick<PrismaClient, "loyaltyBonus">;

export type BusinessLoyaltyBonusItem = {
  id: string;
  amountCents: number;
  pctApplied: number;
  status: LoyaltyBonusStatus;
  method: LoyaltyPayoutMethod | null;
  paidAt: Date | null;
  createdAt: Date;
  paymentId: string;
  paymentAmountCents: number;
  concept: string;
};

/**
 * Loyalty bonuses earned by one business. A bonus is settled outside the
 * platform (voucher or transfer) and never touches the withdrawable balance;
 * the admin-only `notes` field is intentionally not exposed here.
 */
export async function listBusinessLoyaltyBonuses(
  deps: { db: LoyaltyHistoryDb },
  input: { businessId: string; cursor?: string },
): Promise<
  ServiceResult<{
    items: BusinessLoyaltyBonusItem[];
    nextCursor: string | null;
  }>
> {
  if (input.cursor) {
    const cursor = await deps.db.loyaltyBonus.findFirst({
      where: { id: input.cursor, businessId: input.businessId },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Loyalty bonus cursor not found");
    }
  }

  const rows = await deps.db.loyaltyBonus.findMany({
    where: { businessId: input.businessId },
    take: BUSINESS_LOYALTY_BONUSES_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      amountCents: true,
      pctApplied: true,
      status: true,
      method: true,
      paidAt: true,
      createdAt: true,
      payment: {
        select: {
          id: true,
          amountCents: true,
          order: { select: { title: true } },
          paymentLink: { select: { concept: true } },
        },
      },
    },
  });

  const hasNextPage = rows.length > BUSINESS_LOYALTY_BONUSES_PAGE_SIZE;
  const page = rows.slice(0, BUSINESS_LOYALTY_BONUSES_PAGE_SIZE);

  return svcOk({
    items: page.map(({ payment, ...bonus }) => ({
      ...bonus,
      paymentId: payment.id,
      paymentAmountCents: payment.amountCents,
      concept: payment.order?.title ?? payment.paymentLink?.concept ?? "",
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}
