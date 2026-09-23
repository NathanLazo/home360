import { TableSkeleton } from "~/components/table-skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function CorporateLocationsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <TableSkeleton columns={6} rows={6} />
        </CardContent>
      </Card>
    </div>
  );
}
