import type { RouterOutputs } from "~/trpc/react";

type CorporateOutput = RouterOutputs["admin"]["corporate"];

/**
 * Every F7-04 type is inferred from the router so the UI can never drift from
 * the server contract.
 */
export type CorporateListResult = NonNullable<
  CorporateOutput["list"]["result"]
>;

export type CorporateAccountRow = CorporateListResult["items"][number];

export type CorporateCounts = CorporateListResult["counts"];

export type CorporateAccountDetail = NonNullable<
  CorporateOutput["getById"]["result"]
>;

export type CorporateLocationItem = CorporateAccountDetail["locations"][number];

export type CorporateOrderItem = CorporateAccountDetail["orders"][number];

export type CorporateTierRequestItem =
  CorporateAccountDetail["tierChangeRequests"][number];

export type CorporateTierOption = NonNullable<
  CorporateOutput["listTiers"]["result"]
>[number];

export type AccountManagerOption = NonNullable<
  CorporateOutput["listAccountManagers"]["result"]
>[number];

/**
 * Minimal slice an action dialog needs to summarize an account. Both the table
 * row and the detail sheet can produce it, so dialogs never care which surface
 * raised them.
 */
export type CorporateActionTarget = Pick<
  CorporateAccountRow,
  "id" | "name" | "tier" | "status" | "commissionPct" | "monthlyFeeCents"
>;
