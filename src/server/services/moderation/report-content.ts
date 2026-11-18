import "server-only";

import {
  Prisma,
  type ContentReportReason,
  type PrismaClient,
} from "@generated/prisma";
import { isConversationParticipant } from "~/server/services/messaging/participants";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ReportReceipt = { reportId: string };

/**
 * Files a chat report (App Store 1.2): one message, or the whole
 * conversation when `messageId` is absent. Only participants can report,
 * never their own message; re-reporting the same message is idempotent.
 * Reports land in /admin/reports for review within 24 h.
 */
export async function reportConversationContent(
  db: PrismaClient,
  input: {
    reporterId: string;
    conversationId: string;
    messageId?: string;
    reason: ContentReportReason;
    details?: string;
  },
): Promise<ServiceResult<ReportReceipt, "VALIDATION_ERROR">> {
  if (
    !(await isConversationParticipant(
      db,
      input.reporterId,
      input.conversationId,
    ))
  ) {
    return svcFail("NOT_FOUND", "Conversation not found");
  }

  let reportedUserId: string | null = null;

  if (input.messageId) {
    const message = await db.message.findFirst({
      where: { id: input.messageId, conversationId: input.conversationId },
      select: { senderId: true },
    });

    if (!message) {
      return svcFail("NOT_FOUND", "Message not found");
    }

    if (message.senderId === input.reporterId) {
      return svcFail("VALIDATION_ERROR", "Own messages cannot be reported");
    }

    reportedUserId = message.senderId;

    const existing = await db.contentReport.findUnique({
      where: {
        reporterId_messageId: {
          reporterId: input.reporterId,
          messageId: input.messageId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return svcOk({ reportId: existing.id });
    }
  }

  try {
    const report = await db.contentReport.create({
      data: {
        reporterId: input.reporterId,
        conversationId: input.conversationId,
        messageId: input.messageId ?? null,
        reportedUserId,
        reason: input.reason,
        details: input.details ?? null,
      },
      select: { id: true },
    });

    return svcOk({ reportId: report.id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return svcFail("CONFLICT", "Already reported");
    }

    throw error;
  }
}
