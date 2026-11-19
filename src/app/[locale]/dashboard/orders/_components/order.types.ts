import type { RouterOutputs } from "~/trpc/react";

type OrderOutput = RouterOutputs["order"];

export type OrderListResult = NonNullable<OrderOutput["list"]["result"]>;
export type OrderListItem = OrderListResult["items"][number];
export type OrderDetail = NonNullable<OrderOutput["getById"]["result"]>;
export type OrderEvent = OrderDetail["events"][number];

export type WorkerOption = NonNullable<
  RouterOutputs["service"]["listWorkers"]["result"]
>[number];

export type OrderFiltersState = {
  search: string;
  status: "" | OrderListItem["status"];
  type: "" | OrderListItem["type"];
  workerId: string;
  /** `YYYY-MM-DD` from a native date input; empty when unset. */
  from: string;
  to: string;
};
