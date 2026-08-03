import type { RouterOutputs } from "~/trpc/react";

type ServiceOutput = RouterOutputs["service"];

export type ServiceListResult = NonNullable<ServiceOutput["list"]["result"]>;
export type ServiceListItem = ServiceListResult["items"][number];
export type ServiceWorker = NonNullable<
  ServiceOutput["listWorkers"]["result"]
>[number];

export type ServiceFiltersState = {
  search: string;
  category: string;
  status: "" | ServiceListItem["status"];
};

export type ServiceFormValues = {
  name: string;
  category: string;
  price: string;
  duration: string;
  durationMax: string;
  workerIds: string[];
};

export type ServiceFormErrors = Partial<
  Record<keyof ServiceFormValues, string>
>;
