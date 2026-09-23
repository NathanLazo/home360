import "server-only";

import type {
  Prisma,
  PrismaClient,
  QuoteStatus,
  RequestStatus,
} from "@generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PAGE_SIZE = 20;

const myQuoteSelect = {
  id: true,
  status: true,
  amountCents: true,
  scheduledFor: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  worker: { select: { id: true, fullName: true } },
  branch: { select: { name: true } },
  order: { select: { id: true, folio: true } },
  request: {
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      neighborhood: true,
    },
  },
} satisfies Prisma.QuoteSelect;

type MyQuotePayload = Prisma.QuoteGetPayload<{ select: typeof myQuoteSelect }>;

export type MyQuoteItem = {
  id: string;
  status: QuoteStatus;
  amountCents: number;
  scheduledFor: Date | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  workerId: string | null;
  workerName: string | null;
  branchName: string | null;
  /** Set once the customer accepted the offer and the order exists. */
  order: { id: string; folio: number } | null;
  request: {
    id: string;
    title: string;
    category: string;
    status: RequestStatus;
    neighborhood: string | null;
  };
};

export type MyQuoteList = {
  items: MyQuoteItem[];
  nextCursor: string | null;
};

function toMyQuoteItem(quote: MyQuotePayload): MyQuoteItem {
  return {
    id: quote.id,
    status: quote.status,
    amountCents: quote.amountCents,
    scheduledFor: quote.scheduledFor,
    message: quote.message,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    workerId: quote.worker?.id ?? null,
    workerName: quote.worker?.fullName ?? null,
    branchName: quote.branch?.name ?? null,
    order: quote.order,
    request: quote.request,
  };
}

/**
 * Business "Mis ofertas": own quotes newest-activity first, optionally by
 * status, cursor-paginated. Tenant scoping lives in the where clause.
 */
export async function listMyQuotes(
  db: PrismaClient,
  input: { businessId: string; status?: QuoteStatus; cursor?: string },
): Promise<ServiceResult<MyQuoteList>> {
  if (input.cursor) {
    const cursor = await db.quote.findFirst({
      where: { id: input.cursor, businessId: input.businessId },
      select: { id: true },
    });

    if (!cursor) {
      return svcFail("NOT_FOUND", "Quote cursor not found");
    }
  }

  const rows = await db.quote.findMany({
    where: {
      businessId: input.businessId,
      ...(input.status ? { status: input.status } : {}),
    },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: myQuoteSelect,
  });
  const page = rows.slice(0, PAGE_SIZE);

  return svcOk({
    items: page.map(toMyQuoteItem),
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  });
}
