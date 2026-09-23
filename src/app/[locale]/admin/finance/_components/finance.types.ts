import type { WITHDRAWAL_HISTORY_STATUSES } from "./finance.schema";
import type { RouterOutputs } from "~/trpc/react";

type FinanceOutput = RouterOutputs["admin"]["finance"];

export type FinanceKpis = NonNullable<FinanceOutput["getKpis"]["result"]>;

export type WithdrawalsResult = NonNullable<
  FinanceOutput["listWithdrawals"]["result"]
>;

export type WithdrawalRow = WithdrawalsResult["items"][number];

export type RevenueBreakdown = NonNullable<
  FinanceOutput["getRevenueBreakdown"]["result"]
>;

export type RevenuePoint = RevenueBreakdown["series"][number];

export type LoyaltyBonusesResult = NonNullable<
  FinanceOutput["listLoyaltyBonuses"]["result"]
>;

export type LoyaltyBonusRow = LoyaltyBonusesResult["items"][number];

export type WithdrawalHistoryStatus =
  (typeof WITHDRAWAL_HISTORY_STATUSES)[number];

/** Client-side state of the history filters ("" = no bound). */
export type WithdrawalHistoryFilters = {
  status: WithdrawalHistoryStatus | null;
  business: string;
  from: string;
  to: string;
};

export type LoyaltyBonusStatusFilter = LoyaltyBonusRow["status"] | null;
