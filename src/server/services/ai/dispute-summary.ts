import "server-only";

import { generateText } from "ai";

import type { PrismaClient } from "@generated/prisma";
import { env } from "~/env";
import { evidenceKindFromUrl } from "~/lib/evidence-kind";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { DIAGNOSIS_MODEL } from "./diagnose";

/** Same Gateway model as the diagnosis engine: one AI configuration. */
export const DISPUTE_SUMMARY_MODEL = DIAGNOSIS_MODEL;

const SUMMARY_TIMEOUT_MS = 45_000;

/** Hard cap on what is persisted, whatever the model returns. */
const SUMMARY_MAX_CHARS = 1_200;

/** Arguments are clipped before prompting so one essay cannot blow the budget. */
const ARGUMENT_MAX_CHARS = 4_000;

type DisputeSummaryErrorCode = "AI_UNAVAILABLE";

type SummaryDb = Pick<PrismaClient, "dispute">;

const INSTRUCTIONS = [
  "You assist the HOME360 admin team, which arbitrates escrow disputes between",
  "a customer and a home-maintenance business in Chihuahua, Mexico.",
  "",
  "Write a short, neutral case summary for the admin:",
  "- Spanish (Mexico), 3 to 6 sentences, under 120 words, plain prose (no",
  "  markdown, no bullet lists, no headings).",
  "- State what was ordered, what each party claims and what evidence exists",
  "  (recording state and segments, attached files).",
  "- Never take sides and never recommend a resolution or an amount.",
  "- Platform rule you may mention as a fact: the service recording is",
  "  mandatory and uninterrupted; a missing or incomplete recording resolves in",
  "  favour of the customer unless the admin justifies otherwise.",
  "- Do not invent facts that are not in the case file.",
].join("\n");

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > ARGUMENT_MAX_CHARS
    ? `${trimmed.slice(0, ARGUMENT_MAX_CHARS)}…`
    : trimmed;
}

function describeSegments(
  segments: Array<{
    startedAt: Date;
    endedAt: Date | null;
    interrupted: boolean;
  }>,
): string {
  if (segments.length === 0) {
    return "No recording segments were registered.";
  }

  const lines = segments.map((segment, index) => {
    const durationSec =
      segment.endedAt === null
        ? null
        : Math.max(
            0,
            Math.round(
              (segment.endedAt.getTime() - segment.startedAt.getTime()) / 1000,
            ),
          );

    return [
      `Segment ${index + 1}: started ${segment.startedAt.toISOString()}`,
      segment.endedAt === null
        ? "never ended"
        : `ended ${segment.endedAt.toISOString()} (${durationSec}s)`,
      segment.interrupted ? "INTERRUPTED" : "not interrupted",
    ].join(", ");
  });

  return lines.join("\n");
}

function describeEvidence(urls: string[]): string {
  if (urls.length === 0) {
    return "No evidence files were attached.";
  }

  const counts = { image: 0, video: 0, pdf: 0, other: 0 };

  for (const url of urls) {
    counts[evidenceKindFromUrl(url)] += 1;
  }

  return `${urls.length} evidence file(s): ${counts.image} image(s), ${counts.video} video(s), ${counts.pdf} PDF(s), ${counts.other} other.`;
}

/**
 * Generates (or regenerates) the AI summary of a dispute file and persists it
 * on `Dispute.aiSummary`. Only metadata of evidence and recordings reaches the
 * model — never URLs. Every provider failure collapses into `AI_UNAVAILABLE`.
 *
 * Exported for the customer "open dispute" flow as a best-effort follow-up:
 * callers should `void generateDisputeSummary(...)` and ignore failures.
 */
export async function generateDisputeSummary(
  deps: { db: SummaryDb },
  input: { disputeId: string },
): Promise<
  ServiceResult<
    { id: string; aiSummary: string; aiSummaryGeneratedAt: Date },
    DisputeSummaryErrorCode
  >
> {
  if (!env.AI_GATEWAY_API_KEY) {
    return svcFail("AI_UNAVAILABLE", "AI gateway key is not configured");
  }

  const dispute = await deps.db.dispute.findUnique({
    where: { id: input.disputeId },
    select: {
      id: true,
      title: true,
      urgency: true,
      status: true,
      customerArgument: true,
      businessArgument: true,
      evidenceUrls: true,
      evidenceRequestNote: true,
      createdAt: true,
      order: {
        select: {
          type: true,
          title: true,
          amountCents: true,
          status: true,
          recordingUrl: true,
          recordingComplete: true,
          recordingDurationSec: true,
          workNotes: true,
          recordingSegments: {
            orderBy: { startedAt: "asc" },
            select: { startedAt: true, endedAt: true, interrupted: true },
          },
        },
      },
    },
  });

  if (!dispute) {
    return svcFail("NOT_FOUND", "Dispute not found");
  }

  const { order } = dispute;
  const recordingState =
    order.recordingUrl === null
      ? "missing"
      : order.recordingComplete
        ? "complete"
        : "incomplete";

  const prompt = [
    `Dispute title: ${dispute.title}`,
    `Urgency: ${dispute.urgency}. Opened: ${dispute.createdAt.toISOString()}.`,
    `Order: ${order.type} "${order.title}", amount ${(order.amountCents / 100).toFixed(2)} MXN, order status ${order.status}.`,
    order.workNotes ? `Worker notes: ${clip(order.workNotes)}` : null,
    `Recording: ${recordingState}${order.recordingDurationSec === null ? "" : `, ${order.recordingDurationSec}s total`}.`,
    describeSegments(order.recordingSegments),
    describeEvidence(dispute.evidenceUrls),
    `Customer argument: ${clip(dispute.customerArgument)}`,
    dispute.businessArgument
      ? `Business argument: ${clip(dispute.businessArgument)}`
      : "The business has not answered yet.",
    dispute.evidenceRequestNote
      ? `The admin already requested more evidence: ${clip(dispute.evidenceRequestNote)}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  let summary: string;

  try {
    const { text } = await generateText({
      model: DISPUTE_SUMMARY_MODEL,
      instructions: INSTRUCTIONS,
      prompt,
      abortSignal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
    });

    summary = text.trim().slice(0, SUMMARY_MAX_CHARS);
  } catch {
    // Provider details are dropped on purpose; the contract only says the AI
    // is unavailable.
    return svcFail("AI_UNAVAILABLE", "Dispute summary generation failed");
  }

  if (summary.length === 0) {
    return svcFail("AI_UNAVAILABLE", "Dispute summary came back empty");
  }

  const aiSummaryGeneratedAt = new Date();

  await deps.db.dispute.update({
    where: { id: dispute.id },
    data: { aiSummary: summary, aiSummaryGeneratedAt },
  });

  return svcOk({ id: dispute.id, aiSummary: summary, aiSummaryGeneratedAt });
}
