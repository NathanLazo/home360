import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { TableSkeleton } from "../_components/table-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminCorporateLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-9 w-96 max-w-full rounded-md" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-sm" />
        <Skeleton className="h-10 w-48 rounded-sm" />
      </div>
      <TableSkeleton
        columns={[
          { width: "w-40", withAvatar: true },
          { width: "w-16" },
          { width: "w-16" },
          { width: "w-24", align: "end" },
          { width: "w-20" },
          { width: "w-8", align: "end" },
        ]}
      />
    </div>
  );
}
