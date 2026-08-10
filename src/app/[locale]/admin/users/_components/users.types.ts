import type { RouterOutputs } from "~/trpc/react";

type UsersOutput = RouterOutputs["admin"]["users"];

/**
 * Every W10 type is inferred from the router so the UI can never drift from
 * the server contract.
 */
export type ListUsersResult = NonNullable<UsersOutput["list"]["result"]>;

export type BusinessesPage = Extract<ListUsersResult, { tab: "businesses" }>;
export type CustomersPage = Extract<ListUsersResult, { tab: "customers" }>;
export type WorkersPage = Extract<ListUsersResult, { tab: "workers" }>;

export type BusinessRow = BusinessesPage["items"][number];
export type CustomerRow = CustomersPage["items"][number];
export type WorkerRow = WorkersPage["items"][number];

export type UserCounts = ListUsersResult["counts"];

export type BusinessDetail = NonNullable<
  UsersOutput["getBusinessDetail"]["result"]
>;

export type BusinessDocumentItem = BusinessDetail["documents"][number];

export type BusinessOrderItem = BusinessDetail["recentOrders"][number];

export type BusinessDisputeItem = BusinessDetail["disputes"]["items"][number];

export type CsvExport = NonNullable<UsersOutput["exportCsv"]["result"]>;
