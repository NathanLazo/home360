import type { RouterOutputs } from "~/trpc/react";

type RadarOutput = RouterOutputs["radar"];
type QuoteOutput = RouterOutputs["quote"];

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

export type QuotableService = NonNullable<
  RouterOutputs["service"]["listQuotable"]["result"]
>[number];

export type MyQuoteList = NonNullable<QuoteOutput["listMine"]["result"]>;
export type MyQuoteItem = MyQuoteList["items"][number];
