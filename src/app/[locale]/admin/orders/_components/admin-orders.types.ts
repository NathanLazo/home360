import type { RouterOutputs } from "~/trpc/react";

type AdminOrdersOutput = RouterOutputs["admin"]["orders"];

export type AdminOrderList = NonNullable<AdminOrdersOutput["list"]["result"]>;
export type AdminOrderRow = AdminOrderList["items"][number];
export type AdminOrderDetail = NonNullable<
  AdminOrdersOutput["getById"]["result"]
>;
export type AdminOrderEvent = AdminOrderDetail["timeline"][number];
export type AdminSignedMedia = AdminOrderDetail["evidence"]["before"][number];
