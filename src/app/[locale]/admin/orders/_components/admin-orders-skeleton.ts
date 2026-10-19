import type { TableSkeletonColumn } from "../../_components/table-skeleton";

/**
 * Loading shape of the orders table, one bar per real column. Shared by
 * `loading.tsx` (server) and the view (client), so it lives outside both.
 */
export const ADMIN_ORDERS_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-12" },
  { width: "w-40" },
  { width: "w-24" },
  { width: "w-28" },
  { width: "w-28" },
  { width: "w-20", align: "end" },
  { width: "w-20" },
  { width: "w-20" },
  { width: "w-20" },
];
