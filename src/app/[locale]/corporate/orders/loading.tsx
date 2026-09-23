import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function CorporateOrdersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-11 w-full rounded-lg sm:h-10 sm:w-56" />
        <Skeleton className="h-11 w-full rounded-lg sm:h-10 sm:w-44" />
      </div>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <TableSkeleton columns={7} rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}
