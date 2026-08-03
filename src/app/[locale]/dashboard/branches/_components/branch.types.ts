import type { RouterOutputs } from "~/trpc/react";

type BranchOutput = RouterOutputs["branch"];

export type BranchListResult = NonNullable<BranchOutput["list"]["result"]>;
export type BranchListItem = BranchListResult["items"][number];

export type BranchFormValues = {
  name: string;
  address: string;
  managerName: string;
  coverageRadiusKm: string;
};

export type BranchFormErrors = Partial<Record<keyof BranchFormValues, string>>;
