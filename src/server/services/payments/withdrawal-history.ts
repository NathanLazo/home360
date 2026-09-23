import "server-only";

import type { PrismaClient, WithdrawalStatus } from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";

export const BUSINESS_WITHDRAWALS_PAGE_SIZE = 20;

type WithdrawalHistoryDb = Pick<PrismaClient, "withdrawal">;

export type BusinessWithdrawalItem = {
  id: string;
  amountCents: number;
  bankName: string;
  accountLast4: string;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
};

/**
 * Withdrawal history of one business. Same projection as the admin finance
 * listing (requested/resolved dates, bank snapshot, rejection reason) but the
 * tenant scope is mandatory and lives inside the Prisma `where`, and rows are
 * ordered chronologically because the business reads a timeline, not a queue.
 */
export async function listBusinessWithdrawals(
  deps: { db: WithdrawalHistoryDb },
  input: { businessId: string; status?: WithdrawalStatus; cursor?: string },
): Promise<
  ServiceResult<{ items: BusinessWithdrawalItem[]; nextCursor: string | null }>
> {
  if (input.cursor) {
    const cursor = await deps.db.withdrawal.findFirst({
      where: { id: input.cursor, businessId: input.businessId },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Withdrawal cursor not found");
    }
  }

  const rows = await deps.db.withdrawal.findMany({
    where: {
      businessId: input.businessId,
      ...(input.status ? { status: input.status } : {}),
    },
    take: BUSINESS_WITHDRAWALS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      amountCents: true,
      bankName: true,
      accountLast4: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const hasNextPage = rows.length > BUSINESS_WITHDRAWALS_PAGE_SIZE;
  const page = rows.slice(0, BUSINESS_WITHDRAWALS_PAGE_SIZE);

  return svcOk({
    items: page.map(({ createdAt, ...withdrawal }) => ({
      ...withdrawal,
      requestedAt: createdAt,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}
