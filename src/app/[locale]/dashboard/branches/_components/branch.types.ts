import type { RouterOutputs } from "~/trpc/react";

type BranchOutput = RouterOutputs["branch"];

export type BranchListResult = NonNullable<BranchOutput["list"]["result"]>;
export type BranchListItem = BranchListResult["items"][number];

export type BranchKindValue = BranchListItem["kind"];

export type BranchFormValues = {
  /** F11: storefront or warehouse; fixed after creation. */
  kind: BranchKindValue;
  name: string;
  address: string;
  managerName: string;
  coverageRadiusKm: string;
  latitude: string;
  longitude: string;
  /** D10-1: whether customers may pick up products at this branch. */
  pickupEnabled: boolean;
  /** D10-1: whether this branch fills home deliveries. */
  deliveryEnabled: boolean;
};

type BranchTextField = Exclude<
  keyof BranchFormValues,
  "kind" | "pickupEnabled" | "deliveryEnabled"
>;

export type BranchFormErrors = Partial<Record<BranchTextField, string>>;
