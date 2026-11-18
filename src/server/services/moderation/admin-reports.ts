import "server-only";

import {
  ContentReportStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import type {
  ReportAction,
  ReportStatusFilter,
} from "~/app/[locale]/admin/reports/_components/reports.schema";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { getConversationParties } from "./conversation-parties";

const REPORTS_PAGE_SIZE = 20;

const reportSelect = {
  id: true,
  reason: true,
  details: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  conversationId: true,
  reporter: { select: { id: true, name: true, email: true, role: true } },
  reportedUser: { select: { id: true, name: true, email: true, role: true } },
  message: {
    select: {
      id: true,
      type: true,
      body: true,
      attachmentUrl: true,
      hiddenAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ContentReportSelect;

type ReportRow = Prisma.ContentReportGetPayload<{
  select: typeof reportSelect;
}>;

export type AdminReportItem = ReportRow & {
  /** Business behind the chat, to moderate the business side from W10. */
  business: { id: string; name: string } | null;
};

export type AdminReportList = {
  items: AdminReportItem[];
  nextCursor: string | null;
};

/**
 * Report queue for /admin/reports: open reports oldest first (SLA 24 h),
 * resolved ones newest first. Each item carries the business of the chat.
 */
export async function listContentReports(
  db: PrismaClient,
  input: { status: ReportStatusFilter; cursor?: string },
): Promise<ServiceResult<AdminReportList>> {
  const open = input.status === "open";
  const rows = await db.contentReport.findMany({
    where: open
      ? { status: ContentReportStatus.OPEN }
      : { status: { not: ContentReportStatus.OPEN } },
    orderBy: open
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ resolvedAt: "desc" }, { id: "desc" }],
    take: REPORTS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: reportSelect,
  });

  const hasMore = rows.length > REPORTS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, REPORTS_PAGE_SIZE) : rows;
  const businessIds = new Map<string, string>();

  for (const row of page) {
    const parties = await getConversationParties(db, row.conversationId);

    if (parties) {
      businessIds.set(row.conversationId, parties.businessId);
    }
  }

  const businesses = await db.business.findMany({
    where: { id: { in: [...new Set(businessIds.values())] } },
    select: { id: true, name: true },
  });
  const businessById = new Map(businesses.map((b) => [b.id, b]));

  return svcOk({
    items: page.map((row) => {
      const businessId = businessIds.get(row.conversationId);

      return {
        ...row,
        business: businessId ? (businessById.get(businessId) ?? null) : null,
      };
    }),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  });
}

/**
 * Resolves an open report. HIDE_CONTENT hides the reported message for every
 * participant (conversation reports have no message to hide, so they can
 * only be dismissed; suspensions go through the users/businesses tabs).
 * Other open reports of the same message are closed in the same transaction.
 */
export async function resolveContentReport(
  db: PrismaClient,
  input: { reportId: string; action: ReportAction; adminId: string },
): Promise<ServiceResult<{ id: string }, "VALIDATION_ERROR">> {
  const report = await db.contentReport.findUnique({
    where: { id: input.reportId },
    select: { id: true, status: true, messageId: true },
  });

  if (!report) {
    return svcFail("NOT_FOUND", "Report not found");
  }

  if (report.status !== ContentReportStatus.OPEN) {
    return svcFail("CONFLICT", "Report already resolved");
  }

  const now = new Date();
  const resolution = {
    resolvedById: input.adminId,
    resolvedAt: now,
  };

  if (input.action === "DISMISS") {
    await db.contentReport.update({
      where: { id: report.id },
      data: { ...resolution, status: ContentReportStatus.DISMISSED },
    });

    return svcOk({ id: report.id });
  }

  const messageId = report.messageId;

  if (!messageId) {
    return svcFail(
      "VALIDATION_ERROR",
      "Conversation reports have no content to hide",
    );
  }

  await db.$transaction([
    db.message.updateMany({
      where: { id: messageId, hiddenAt: null },
      data: { hiddenAt: now },
    }),
    db.contentReport.updateMany({
      where: { messageId, status: ContentReportStatus.OPEN },
      data: { ...resolution, status: ContentReportStatus.CONTENT_HIDDEN },
    }),
  ]);

  return svcOk({ id: report.id });
}
