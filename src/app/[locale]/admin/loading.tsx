import { AiConfigCardSkeleton } from "./_components/ai-config-card-skeleton";
import { KpiGridSkeleton } from "./_components/kpi-grid-skeleton";
import { OpenDisputesSkeleton } from "./_components/open-disputes-skeleton";
import { PageHeaderSkeleton } from "./_components/page-header-skeleton";
import { TableSkeleton } from "./_components/table-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Route-level fallback: the same shapes the client view uses per section, so
 * the jump from this skeleton to the hydrated page never shifts layout.
 */
export default function AdminOverviewLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton />
      <KpiGridSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-44" />
          <TableSkeleton
            rows={3}
            columns={[
              { width: "w-36" },
              { width: "w-20" },
              { width: "w-24" },
              { width: "w-32", align: "end" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <AiConfigCardSkeleton />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <OpenDisputesSkeleton />
      </div>
    </div>
  );
}
