import type { RouterOutputs } from "~/trpc/react";

/** Types derived from the tRPC envelopes so the UI never imports server modules. */
export type ProfileSummary = NonNullable<
  RouterOutputs["profile"]["get"]["result"]
>;
export type ProfileDevice = ProfileSummary["devices"][number];

export type AiBillingSummary = NonNullable<
  RouterOutputs["aiBilling"]["getSummary"]["result"]
>;
export type AiModelUsage = AiBillingSummary["monthUsage"][number];
export type AiCreditPack = AiBillingSummary["packs"][number];
export type AiUsageRow = NonNullable<
  RouterOutputs["aiBilling"]["listUsage"]["result"]
>["items"][number];
export type AiPurchaseRow = NonNullable<
  RouterOutputs["aiBilling"]["listPurchases"]["result"]
>[number];

export const PROFILE_SECTIONS = [
  "account",
  "security",
  "devices",
  "assistant",
  "billing",
  "workspace",
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number];

/** `code` is `null` on success and on a transport failure with no server code. */
export type MutationOutcome = { ok: boolean; code: string | null };

/** How long a submit button holds its success check. */
export const SAVED_FEEDBACK_MS = 2000;
