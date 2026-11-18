import type { RouterOutputs } from "~/trpc/react";

type ReportListResult = NonNullable<
  RouterOutputs["admin"]["reports"]["list"]["result"]
>;

export type ReportItem = ReportListResult["items"][number];
