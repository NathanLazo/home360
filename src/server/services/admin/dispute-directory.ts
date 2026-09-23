import {
  DisputeStatus,
  type DisputeUrgency,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";

import {
  DISPUTES_PAGE_SIZE,
  type DisputeFilter,
} from "~/app/[locale]/admin/disputes/_components/disputes.schema";
import { getFinancialMonthBounds } from "../payments/balances";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

type DisputeDb = Pick<PrismaClient, "dispute">;

/** Single source of truth for "still on the admin's desk". */
export const OPEN_DISPUTE_STATUSES = [
  DisputeStatus.OPEN,
  DisputeStatus.IN_REVIEW,
] as const;

function statusWhere(
  filter: DisputeFilter | undefined,
): Prisma.DisputeWhereInput {
  if (filter === "open") {
    return { status: { in: [...OPEN_DISPUTE_STATUSES] } };
  }

  if (filter === "in_review") {
    return { status: DisputeStatus.IN_REVIEW };
  }

  if (filter === "resolved") {
    return { status: DisputeStatus.RESOLVED };
  }

  return {};
}

/**
 * Free-text search: a numeric term (optionally "#123") matches the order
 * folio exactly; any term also matches the title and both parties' names.
 */
function searchWhere(search: string | undefined): Prisma.DisputeWhereInput {
  const term = search?.trim() ?? "";

  if (term.length === 0) {
    return {};
  }

  const contains = { contains: term, mode: "insensitive" as const };
  const digits = term.replace(/^#/u, "");
  const folio = /^\d{1,9}$/u.test(digits) ? Number(digits) : null;

  return {
    OR: [
      ...(folio === null ? [] : [{ order: { is: { folio } } }]),
      { title: contains },
      { business: { is: { name: contains } } },
      { order: { is: { customer: { is: { name: contains } } } } },
    ],
  };
}

export function disputeFilterWhere(
  filter: DisputeFilter | undefined,
  options: { urgency?: DisputeUrgency; search?: string } = {},
): Prisma.DisputeWhereInput {
  return {
    AND: [
      statusWhere(filter),
      options.urgency ? { urgency: options.urgency } : {},
      searchWhere(options.search),
    ],
  };
}

const listSelect = {
  id: true,
  title: true,
  status: true,
  urgency: true,
  createdAt: true,
  resolvedAt: true,
  resolution: true,
  business: { select: { name: true } },
  order: {
    select: {
      folio: true,
      customer: { select: { name: true } },
      payment: { select: { amountCents: true } },
    },
  },
} satisfies Prisma.DisputeSelect;

export async function listDisputes(
  deps: { db: DisputeDb },
  input: {
    status?: DisputeFilter;
    urgency?: DisputeUrgency;
    search?: string;
    cursor?: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const month = getFinancialMonthBounds(now);

  const [rows, openCount, resolvedThisMonth] = await Promise.all([
    deps.db.dispute.findMany({
      where: disputeFilterWhere(input.status, {
        urgency: input.urgency,
        search: input.search,
      }),
      take: DISPUTES_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: listSelect,
    }),
    deps.db.dispute.count({
      where: { status: { in: [...OPEN_DISPUTE_STATUSES] } },
    }),
    deps.db.dispute.count({
      where: {
        status: DisputeStatus.RESOLVED,
        resolvedAt: { gte: month.start, lt: month.end },
      },
    }),
  ]);

  const hasNextPage = rows.length > DISPUTES_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, DISPUTES_PAGE_SIZE) : rows;

  return svcOk({
    items: page.map((dispute) => ({
      id: dispute.id,
      title: dispute.title,
      status: dispute.status,
      urgency: dispute.urgency,
      businessName: dispute.business.name,
      customerName: dispute.order.customer.name,
      orderFolio: dispute.order.folio,
      amountCents: dispute.order.payment?.amountCents ?? 0,
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
      resolution: dispute.resolution,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    openCount,
    resolvedThisMonth,
  });
}

export async function getDisputeById(
  deps: { db: DisputeDb },
  input: { disputeId: string },
) {
  const dispute = await deps.db.dispute.findUnique({
    where: { id: input.disputeId },
    select: {
      id: true,
      title: true,
      status: true,
      urgency: true,
      createdAt: true,
      resolvedAt: true,
      resolution: true,
      resolutionAmountCents: true,
      resolutionNotes: true,
      recordingCompleteAtResolution: true,
      customerArgument: true,
      businessArgument: true,
      evidenceUrls: true,
      aiSummary: true,
      aiSummaryGeneratedAt: true,
      evidenceRequestNote: true,
      evidenceRequestedAt: true,
      business: { select: { id: true, name: true } },
      order: {
        select: {
          id: true,
          folio: true,
          title: true,
          amountCents: true,
          status: true,
          createdAt: true,
          recordingUrl: true,
          recordingComplete: true,
          recordingDurationSec: true,
          recordingSegments: {
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              startedAt: true,
              endedAt: true,
              interrupted: true,
              uploadedAt: true,
            },
          },
          customer: { select: { id: true, name: true } },
          payment: {
            select: {
              id: true,
              status: true,
              amountCents: true,
              providerAmountCents: true,
              serviceFeeCentsApplied: true,
              commissionCents: true,
              providerRefundedCents: true,
              serviceFeeRefundedCents: true,
              refundedCents: true,
            },
          },
        },
      },
    },
  });

  if (!dispute) {
    return svcFail("NOT_FOUND", "Dispute not found");
  }

  const { order, business, ...rest } = dispute;

  return svcOk({
    ...rest,
    recordingUrl: order.recordingUrl,
    recordingComplete: order.recordingComplete,
    recordingDurationSec: order.recordingDurationSec,
    recordingSegments: order.recordingSegments,
    business,
    customer: order.customer,
    order: {
      id: order.id,
      folio: order.folio,
      title: order.title,
      amountCents: order.amountCents,
      status: order.status,
      createdAt: order.createdAt,
    },
    payment: order.payment,
  });
}

export type ListDisputesResult =
  Awaited<ReturnType<typeof listDisputes>> extends ServiceResult<
    infer TData,
    string
  >
    ? TData
    : never;
