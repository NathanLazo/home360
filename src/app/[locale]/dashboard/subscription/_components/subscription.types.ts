import type { RouterOutputs } from "~/trpc/react";

type SubscriptionOutput = RouterOutputs["subscription"];

/**
 * Every W7 type is inferred from the `result` of the envelope, so the UI can
 * never drift from the server contract and never treats the envelope root as
 * if it were the payload.
 */
export type CurrentSubscription = NonNullable<
  SubscriptionOutput["getCurrent"]["result"]
>;

export type SubscriptionStatusValue = CurrentSubscription["status"];

export type PlanUsageReport = CurrentSubscription["usage"];

export type PlanListItem = NonNullable<
  SubscriptionOutput["listPlans"]["result"]
>[number];

export type PlanChangePreview = NonNullable<
  SubscriptionOutput["previewChange"]["result"]
>;

export type InvoiceListResult = NonNullable<
  SubscriptionOutput["listInvoices"]["result"]
>;

export type InvoiceListItem = InvoiceListResult["items"][number];

export type InvoiceStatusValue = InvoiceListItem["status"];
