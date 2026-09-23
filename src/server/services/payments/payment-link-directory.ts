import "server-only";

import {
  PaymentLinkStatus,
  type PaymentStatus,
  type PrismaClient,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";

export const PAYMENT_LINKS_PAGE_SIZE = 20;

type PaymentLinkDirectoryDb = Pick<PrismaClient, "paymentLink">;

export type PaymentLinkListItem = {
  id: string;
  concept: string;
  /** Provider principal the business asked for. */
  amountCents: number;
  /** What the customer pays: principal plus the flat service fee snapshot. */
  totalCents: number;
  status: PaymentLinkStatus;
  /** Present only once published; a CREATING row has no shareable URL. */
  url: string | null;
  paidAt: Date | null;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  createdAt: Date;
};

export async function listBusinessPaymentLinks(
  deps: { db: PaymentLinkDirectoryDb },
  input: {
    businessId: string;
    status?: PaymentLinkStatus;
    cursor?: string;
  },
): Promise<
  ServiceResult<{ items: PaymentLinkListItem[]; nextCursor: string | null }>
> {
  if (input.cursor) {
    const cursor = await deps.db.paymentLink.findFirst({
      where: { id: input.cursor, businessId: input.businessId },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Payment link cursor not found");
    }
  }

  const rows = await deps.db.paymentLink.findMany({
    where: {
      businessId: input.businessId,
      ...(input.status ? { status: input.status } : {}),
    },
    take: PAYMENT_LINKS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      concept: true,
      amountCents: true,
      serviceFeeCentsApplied: true,
      status: true,
      stripeUrl: true,
      paidAt: true,
      createdAt: true,
      payment: { select: { id: true, status: true } },
    },
  });

  const hasNextPage = rows.length > PAYMENT_LINKS_PAGE_SIZE;
  const page = rows.slice(0, PAYMENT_LINKS_PAGE_SIZE);

  return svcOk({
    items: page.map((link) => ({
      id: link.id,
      concept: link.concept,
      amountCents: link.amountCents,
      totalCents: link.amountCents + link.serviceFeeCentsApplied,
      status: link.status,
      url: link.status === PaymentLinkStatus.CREATING ? null : link.stripeUrl,
      paidAt: link.paidAt,
      paymentId: link.payment?.id ?? null,
      paymentStatus: link.payment?.status ?? null,
      createdAt: link.createdAt,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}
