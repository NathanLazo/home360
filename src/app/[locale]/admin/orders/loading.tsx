import { ADMIN_ORDERS_SKELETON_COLUMNS } from "./_components/admin-orders-skeleton";
import { TableSkeleton } from "../_components/table-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminOrdersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-8 flex-1 rounded-full" />
        <Skeleton className="h-8 w-44 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <TableSkeleton columns={ADMIN_ORDERS_SKELETON_COLUMNS} rows={8} />
    </div>
  );
}
