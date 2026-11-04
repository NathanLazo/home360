import type { RequestCategory } from "~/schemas/marketplace/request-categories";
import type { RouterOutputs } from "~/trpc/react";

type ServiceOutput = RouterOutputs["service"];

export type ServiceListResult = NonNullable<ServiceOutput["list"]["result"]>;
export type ServiceListItem = ServiceListResult["items"][number];
export type ServiceWorker = NonNullable<
  ServiceOutput["listWorkers"]["result"]
>[number];

export type ServiceFiltersState = {
  search: string;
  category: "" | RequestCategory;
  status: "" | ServiceListItem["status"];
};

export type ServiceFormValues = {
  name: string;
  categories: RequestCategory[];
  price: string;
  duration: string;
  durationMax: string;
  diagnosticEnabled: boolean;
  diagnosticPrice: string;
  diagnosticCredited: boolean;
  workerIds: string[];
};

export type ServiceFormErrors = Partial<
  Record<keyof ServiceFormValues, string>
>;
