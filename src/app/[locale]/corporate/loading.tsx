import { KpiRowSkeleton } from "~/components/kpi-row-skeleton";
import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function CorporateLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      <KpiRowSkeleton />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={5} rows={4} />
        </CardContent>
      </Card>
    </div>
  );
}
