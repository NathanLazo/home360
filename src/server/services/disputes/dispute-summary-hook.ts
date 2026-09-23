import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { generateDisputeSummary } from "~/server/services/ai/dispute-summary";

/**
 * Best-effort AI summary right after a dispute opens (workstream D). It never
 * delays or fails the customer's response: the call runs detached and any
 * failure is only logged (admins can regenerate it from W11).
 */
export function requestDisputeSummary(
  db: PrismaClient,
  disputeId: string,
): void {
  void generateDisputeSummary({ db }, { disputeId })
    .then((summary) => {
      if (!summary.ok) {
        console.error("[dispute-summary] SUMMARY_SKIPPED", {
          disputeId,
          code: summary.code,
        });
      }
    })
    .catch(() => {
      console.error("[dispute-summary] SUMMARY_FAILED", { disputeId });
    });
}
