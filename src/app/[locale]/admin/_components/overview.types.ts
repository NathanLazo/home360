import type { RouterOutputs } from "~/trpc/react";

type OverviewOutput = RouterOutputs["admin"]["overview"];

/**
 * Every W9 type is inferred from the router so the UI can never drift from the
 * server contract. Components always receive the unwrapped success payload.
 */
export type PlatformKpis = NonNullable<OverviewOutput["getKpis"]["result"]>;

export type PendingBusinessRow = NonNullable<
  OverviewOutput["getPendingBusinesses"]["result"]
>[number];

export type OpenDisputeItem = NonNullable<
  OverviewOutput["getOpenDisputes"]["result"]
>[number];

export type AiConfigSummary = NonNullable<
  OverviewOutput["getAiConfigSummary"]["result"]
>;
