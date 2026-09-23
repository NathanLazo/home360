import "server-only";

import { QuoteStatus, type Prisma, type PrismaClient } from "@generated/prisma";

import type { CorporateRequestListInput } from "~/server/api/schemas/corporate";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";

const REQUEST_PAGE_SIZE = 10;
const QUOTES_PER_REQUEST = 20;

/** Quotes a corporate buyer can still see (withdrawn/rejected are noise). */
const VISIBLE_QUOTE_STATUSES: QuoteStatus[] = [
  QuoteStatus.PENDING,
  QuoteStatus.ACCEPTED,
];

const corporateRequestSelect = {
  id: true,
  title: true,
  category: true,
  description: true,
  status: true,
  createdAt: true,
  corporateLocation: { select: { id: true, name: true } },
  quotes: {
    where: { status: { in: VISIBLE_QUOTE_STATUSES } },
    orderBy: [{ amountCents: "asc" }, { id: "asc" }],
    take: QUOTES_PER_REQUEST,
    select: {
      id: true,
      status: true,
      amountCents: true,
      scheduledFor: true,
      message: true,
      business: {
        select: { name: true, ratingAvg: true, ratingCount: true },
      },
      order: { select: { id: true, folio: true, status: true } },
    },
  },
} satisfies Prisma.ServiceRequestSelect;

export type CorporateRequestItem = Prisma.ServiceRequestGetPayload<{
  select: typeof corporateRequestSelect;
}>;

export type CorporateRequestListResult = {
  items: CorporateRequestItem[];
  nextCursor: string | null;
};

/**
 * Service requests the account raised from its locations, with the offers
 * received (F7 corporate consumer, workstream D). Tenant filter lives in the
 * Prisma where; a foreign location or cursor answers NOT_FOUND.
 */
export async function listCorporateRequests(
  db: PrismaClient,
  corporateAccountId: string,
  input: CorporateRequestListInput,
): Promise<TrpcResponse<CorporateRequestListResult>> {
  if (input.locationId) {
    const location = await db.corporateLocation.findFirst({
      where: { id: input.locationId, corporateAccountId },
      select: { id: true },
    });

    if (!location) {
      return fail("NOT_FOUND", 404, "Corporate location not found");
    }
  }

  const where: Prisma.ServiceRequestWhereInput = {
    corporateAccountId,
    ...(input.locationId ? { corporateLocationId: input.locationId } : {}),
  };

  if (input.cursor) {
    const cursor = await db.serviceRequest.findFirst({
      where: { ...where, id: input.cursor },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Request cursor not found");
    }
  }

  const rows = await db.serviceRequest.findMany({
    where,
    take: REQUEST_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: corporateRequestSelect,
  });
  const items = rows.slice(0, REQUEST_PAGE_SIZE);

  return ok(
    {
      items,
      nextCursor:
        rows.length > REQUEST_PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
    },
    "Corporate requests loaded",
  );
}
