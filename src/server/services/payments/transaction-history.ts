import "server-only";

import {
  PaymentLinkStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { providerTransferCents } from "./financial-projections";

export const TRANSACTIONS_PAGE_SIZE = 20;

type TransactionHistoryDb = Pick<PrismaClient, "payment">;

const transactionSelect = {
  id: true,
  amountCents: true,
  providerAmountCents: true,
  serviceFeeCentsApplied: true,
  commissionPctApplied: true,
  commissionCents: true,
  providerRefundedCents: true,
  refundedCents: true,
  method: true,
  status: true,
  escrowReleaseAt: true,
  releasedAt: true,
  createdAt: true,
  orderId: true,
  paymentLinkId: true,
  order: {
    select: {
      folio: true,
      title: true,
      customer: { select: { name: true } },
      branch: { select: { name: true } },
    },
  },
  paymentLink: { select: { concept: true, status: true, stripeUrl: true } },
} satisfies Prisma.PaymentSelect;

type TransactionPayload = Prisma.PaymentGetPayload<{
  select: typeof transactionSelect;
}>;

/**
 * One row of the business transactions table. It carries the detail fields
 * too, so the detail sheet renders from the loaded row without a second
 * round-trip. Every amount is a server-side figure; the client only formats.
 */
export type TransactionListItem = {
  id: string;
  customerName: string | null;
  concept: string;
  amountCents: number;
  providerAmountCents: number;
  serviceFeeCents: number;
  commissionPct: number;
  commissionCents: number;
  refundedCents: number;
  /** XC-25 provider net: principal minus refunded principal and commission. */
  netAmountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  escrowReleaseAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  orderId: string | null;
  orderFolio: number | null;
  branchName: string | null;
  paymentLinkId: string | null;
  /** Only while the link can still be paid; a used or inactive URL is noise. */
  paymentLinkUrl: string | null;
};

function toTransactionListItem(
  payment: TransactionPayload,
): TransactionListItem {
  const link = payment.paymentLink;

  return {
    id: payment.id,
    customerName: payment.order?.customer.name ?? null,
    concept: payment.order?.title ?? link?.concept ?? "",
    amountCents: payment.amountCents,
    providerAmountCents: payment.providerAmountCents,
    serviceFeeCents: payment.serviceFeeCentsApplied,
    commissionPct: payment.commissionPctApplied,
    commissionCents: payment.commissionCents,
    refundedCents: payment.refundedCents,
    netAmountCents: providerTransferCents({
      providerAmountCents: payment.providerAmountCents,
      providerRefundedCents: payment.providerRefundedCents,
      commissionCents: payment.commissionCents,
    }),
    method: payment.method,
    status: payment.status,
    escrowReleaseAt: payment.escrowReleaseAt,
    releasedAt: payment.releasedAt,
    createdAt: payment.createdAt,
    orderId: payment.orderId,
    orderFolio: payment.order?.folio ?? null,
    branchName: payment.order?.branch?.name ?? null,
    paymentLinkId: payment.paymentLinkId,
    paymentLinkUrl:
      link?.status === PaymentLinkStatus.ACTIVE ? link.stripeUrl : null,
  };
}

export type ListBusinessTransactionsInput = {
  businessId: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  branchId?: string;
  cursor?: string;
};

export async function listBusinessTransactions(
  deps: { db: TransactionHistoryDb },
  input: ListBusinessTransactionsInput,
): Promise<
  ServiceResult<{ items: TransactionListItem[]; nextCursor: string | null }>
> {
  if (input.cursor) {
    const cursor = await deps.db.payment.findFirst({
      where: { id: input.cursor, businessId: input.businessId },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Transaction cursor not found");
    }
  }

  const payments = await deps.db.payment.findMany({
    where: {
      businessId: input.businessId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.method ? { method: input.method } : {}),
      // Branch scope rides on the order; link payments have no branch and
      // drop out of a branch-filtered view by design.
      ...(input.branchId
        ? { order: { branchId: input.branchId, businessId: input.businessId } }
        : {}),
    },
    take: TRANSACTIONS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: transactionSelect,
  });

  const hasNextPage = payments.length > TRANSACTIONS_PAGE_SIZE;
  const items = payments
    .slice(0, TRANSACTIONS_PAGE_SIZE)
    .map(toTransactionListItem);

  return svcOk({
    items,
    nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
  });
}
