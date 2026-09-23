import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Mirrors the products screen (header, filters and list) so the swap from
 * route loading to data does not shift the layout.
 */
export function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 w-full sm:w-48" />
        <Skeleton className="h-11 w-full sm:w-40" />
        <Skeleton className="h-11 w-full sm:w-36" />
      </div>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <TableSkeleton columns={7} rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}
