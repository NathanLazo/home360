import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { UsersTableSkeleton } from "./_components/users-table-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminUsersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-80 max-w-full rounded-md" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-sm" />
        <Skeleton className="h-10 w-48 rounded-sm" />
        <Skeleton className="h-10 w-36 rounded-sm" />
      </div>
      <UsersTableSkeleton tab="businesses" />
    </div>
  );
}
