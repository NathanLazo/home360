import { KpiGridSkeleton } from "../_components/kpi-grid-skeleton";
import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { TableSkeleton } from "../_components/table-skeleton";
import { RevenueBreakdownSkeleton } from "./_components/revenue-breakdown-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminFinanceLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <PageHeaderSkeleton />
      <KpiGridSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RevenueBreakdownSkeleton />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-48 rounded-md" />
        </div>
        <TableSkeleton
          rows={5}
          columns={[
            { width: "w-36" },
            { width: "w-24", align: "end" },
            { width: "w-28" },
            { width: "w-20" },
            { width: "w-20" },
            { width: "w-32", align: "end" },
          ]}
        />
      </div>
    </div>
  );
}
