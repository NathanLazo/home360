import type { RouterOutputs } from "~/trpc/react";

type OrderOutput = RouterOutputs["order"];
type RadarOutput = RouterOutputs["radar"];
type QuoteOutput = RouterOutputs["quote"];

export type OrderListResult = NonNullable<OrderOutput["list"]["result"]>;
export type OrderListItem = OrderListResult["items"][number];
export type OrderDetail = NonNullable<OrderOutput["getById"]["result"]>;
export type OrderEvent = OrderDetail["events"][number];

export type WorkerOption = NonNullable<
  RouterOutputs["service"]["listWorkers"]["result"]
>[number];

export type RadarRequestList = NonNullable<
  RadarOutput["listOpenRequests"]["result"]
>;
export type RadarRequestItem = RadarRequestList["items"][number];
export type RadarRequestDetail = NonNullable<
  RadarOutput["getRequest"]["result"]
>;
export type RadarOwnQuote = NonNullable<RadarRequestDetail["ownQuote"]>;

export type MyQuoteList = NonNullable<QuoteOutput["listMine"]["result"]>;
export type MyQuoteItem = MyQuoteList["items"][number];

export type OrderFiltersState = {
  search: string;
  status: "" | OrderListItem["status"];
  type: "" | OrderListItem["type"];
  workerId: string;
  /** `YYYY-MM-DD` from a native date input; empty when unset. */
  from: string;
  to: string;
};
