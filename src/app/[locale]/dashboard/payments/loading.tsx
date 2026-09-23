import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <KpiRowSkeleton count={4} />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <TableSkeleton columns={6} rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}
