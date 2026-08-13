import type { RouterOutputs } from "~/trpc/react";

type CorporateOutput = RouterOutputs["corporate"];

export type CorporateOverview = NonNullable<
  CorporateOutput["getOverview"]["result"]
>;
export type CorporateOrderListResult = NonNullable<
  CorporateOutput["listOrders"]["result"]
>;
export type CorporateOrderItem = CorporateOrderListResult["items"][number];
export type CorporateOrderStatus = CorporateOrderItem["status"];
export type CorporateLocationListResult = NonNullable<
  CorporateOutput["listLocations"]["result"]
>;
export type CorporateLocationItem = CorporateLocationListResult["items"][number];
export type CorporateMembershipSummary = NonNullable<
  CorporateOutput["getMembership"]["result"]
>;
export type CorporateInvoiceListResult = NonNullable<
  CorporateOutput["listInvoices"]["result"]
>;
export type CorporateInvoiceItem = CorporateInvoiceListResult["items"][number];
