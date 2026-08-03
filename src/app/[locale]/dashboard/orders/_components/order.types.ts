import type { RouterOutputs } from "~/trpc/react";

type OrderOutput = RouterOutputs["order"];

export type OrderListResult = NonNullable<OrderOutput["list"]["result"]>;
export type OrderListItem = OrderListResult["items"][number];
export type OrderDetail = NonNullable<OrderOutput["getById"]["result"]>;

export type OrderFiltersState = {
  search: string;
  status: "" | OrderListItem["status"];
  type: "" | OrderListItem["type"];
};
