import "server-only";

import type {
  CorporateStatus,
  CorporateTier,
  InvoiceStatus,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
} from "@generated/prisma";

import type { CorporateInvoiceListInput } from "~/server/api/schemas/corporate";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";

const DEFAULT_INVOICE_PAGE_SIZE = 10;

export type CorporateMembershipSummary = {
  tier: CorporateTier;
  status: CorporateStatus;
  statusReason: string | null;
  commissionPct: number;
  monthlyFeeCents: number;
  membership: {
    status: SubscriptionStatus;
    renewsAt: Date | null;
  } | null;
  usage: { used: number; max: number | null };
  pendingRequest: {
    id: string;
    requestedTier: CorporateTier;
    notes: string | null;
    createdAt: Date;
  } | null;
};

export type CorporateInvoiceItem = {
  id: string;
  amountCents: number;
  status: InvoiceStatus;
  pdfUrl: string | null;
  issuedAt: Date;
};

export type CorporateInvoiceListResult = {
  items: CorporateInvoiceItem[];
  nextCursor: string | null;
};

/**
 * Membership file of the account: negotiated terms, Stripe membership state,
 * location usage against the tier limit and the pending tier-change request,
 * if any. Everything is selected explicitly so `statusReason` is the only
 * internal note the UI ever sees.
 */
export async function getCorporateMembership(
  db: PrismaClient,
  corporateAccountId: string,
): Promise<TrpcResponse<CorporateMembershipSummary>> {
  const [account, activeLocations, pendingRequest] = await Promise.all([
    db.corporateAccount.findUnique({
      where: { id: corporateAccountId },
      select: {
        tier: true,
        status: true,
        statusReason: true,
        commissionPct: true,
        monthlyFeeCents: true,
        maxLocations: true,
        membership: { select: { status: true, renewsAt: true } },
      },
    }),
    db.corporateLocation.count({
      where: { corporateAccountId, isActive: true },
    }),
    db.corporateTierChangeRequest.findFirst({
      where: { corporateAccountId, status: "PENDING" },
      select: {
        id: true,
        requestedTier: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);

  if (!account) {
    return fail("NOT_FOUND", 404, "Corporate account not found");
  }

  return ok(
    {
      tier: account.tier,
      status: account.status,
      statusReason: account.statusReason,
      commissionPct: account.commissionPct,
      monthlyFeeCents: account.monthlyFeeCents,
      membership: account.membership,
      usage: { used: activeLocations, max: account.maxLocations },
      pendingRequest,
    },
    "Corporate membership loaded",
  );
}

const invoiceSelect = {
  id: true,
  amountCents: true,
  status: true,
  pdfUrl: true,
  issuedAt: true,
} satisfies Prisma.CorporateInvoiceSelect;

/**
 * Consolidated membership invoices: one customer and one subscription cover
 * the whole account, so the rows are filtered by `corporateAccountId` only
 * and paginated by `issuedAt desc, id desc`. A `null` pdfUrl is returned as
 * such; the UI disables the download.
 */
export async function listCorporateInvoices(
  db: PrismaClient,
  corporateAccountId: string,
  input: CorporateInvoiceListInput,
): Promise<TrpcResponse<CorporateInvoiceListResult>> {
  if (input.cursor) {
    const cursor = await db.corporateInvoice.findFirst({
      where: { id: input.cursor, corporateAccountId },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Invoice cursor not found");
    }
  }

  const pageSize = input.limit ?? DEFAULT_INVOICE_PAGE_SIZE;
  const invoices = await db.corporateInvoice.findMany({
    where: { corporateAccountId },
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    select: invoiceSelect,
  });
  const hasNextPage = invoices.length > pageSize;
  const items = invoices.slice(0, pageSize);

  return ok(
    {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
    "Corporate invoices loaded",
  );
}
