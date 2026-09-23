import type { RouterOutputs } from "~/trpc/react";

export type CorporateRequestListResult = NonNullable<
  RouterOutputs["corporate"]["listRequests"]["result"]
>;

export type CorporateRequestItem = CorporateRequestListResult["items"][number];

export type CorporateOrderDetail = NonNullable<
  RouterOutputs["corporate"]["getOrder"]["result"]
>;
