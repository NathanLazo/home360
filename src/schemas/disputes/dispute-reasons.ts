/** Why a consumer opens a dispute (workstream D). UI translates each key. */
export const DISPUTE_REASONS = [
  "NOT_COMPLETED",
  "POOR_QUALITY",
  "DAMAGE",
  "NO_SHOW",
  "OVERCHARGE",
  "OTHER",
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number];
