import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      <KpiRowSkeleton />

      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-md xl:col-span-2" />
        <Skeleton className="h-80 rounded-md" />
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="flex-row items-center justify-between gap-4 border-b py-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="px-0">
          <TableSkeleton columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}
