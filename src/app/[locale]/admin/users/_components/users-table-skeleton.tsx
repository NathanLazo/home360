import type { UsersTab } from "./users.schema";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "../../_components/table-skeleton";

const COLUMNS: Record<UsersTab, TableSkeletonColumn[]> = {
  businesses: [
    { width: "w-32", withAvatar: true },
    { width: "w-20" },
    { width: "w-20" },
    { width: "w-8", align: "end" },
    { width: "w-16" },
    { width: "w-8", align: "end" },
  ],
  customers: [
    { width: "w-32", withAvatar: true },
    { width: "w-44" },
    { width: "w-8", align: "end" },
    { width: "w-20" },
  ],
  workers: [
    { width: "w-32", withAvatar: true },
    { width: "w-28" },
    { width: "w-24" },
    { width: "w-20" },
    { width: "w-20" },
    { width: "w-20" },
  ],
};

/** Loading shape of the active users tab: its own columns, not a generic bar. */
export function UsersTableSkeleton({
  tab,
  label,
}: {
  tab: UsersTab;
  label?: string;
}) {
  return <TableSkeleton columns={COLUMNS[tab]} label={label} />;
}
