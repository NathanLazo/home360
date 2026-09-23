import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { TableSkeleton } from "../_components/table-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminCorporateLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-9 w-96 max-w-full rounded-lg" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
      <TableSkeleton
        columns={[
          { width: "w-40" },
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
