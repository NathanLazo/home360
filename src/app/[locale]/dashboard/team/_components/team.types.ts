import type { RouterOutputs } from "~/trpc/react";

type TeamOutput = RouterOutputs["team"];
type BranchOutput = RouterOutputs["branch"];

export type TeamListResult = NonNullable<TeamOutput["list"]["result"]>;
export type WorkerListItem = TeamListResult["items"][number];
export type TeamLimit = TeamListResult["limit"];
export type BranchOption = NonNullable<
  BranchOutput["list"]["result"]
>["items"][number];

export type WorkerFormValues = {
  fullName: string;
  specialty: string;
  invitedEmail: string;
  branchId: string;
};

export type WorkerFormErrors = Partial<Record<keyof WorkerFormValues, string>>;
