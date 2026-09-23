import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 min-w-0 flex-1" />
        <Skeleton className="h-11 w-full sm:w-44" />
        <Skeleton className="h-11 w-full sm:w-40" />
      </div>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <TableSkeleton columns={8} rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}
