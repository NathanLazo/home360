import type { RouterOutputs } from "~/trpc/react";

type DisputesOutput = RouterOutputs["admin"]["disputes"];

export type DisputeListResult = NonNullable<DisputesOutput["list"]["result"]>;

export type DisputeListItem = DisputeListResult["items"][number];

export type DisputeDetail = NonNullable<DisputesOutput["getById"]["result"]>;

export type DisputePayment = NonNullable<DisputeDetail["payment"]>;

export type DisputeRecordingSegment =
  DisputeDetail["recordingSegments"][number];
