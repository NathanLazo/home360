import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Loading shape of a KPI row: same grid, same card anatomy (label + icon,
 * figure, delta) so the content lands without any layout shift.
 */
export function KpiGridSkeleton({
  count = 4,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
      role="status"
    >
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardHeader className="grid-cols-[1fr_auto]">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="col-start-2 row-span-2 row-start-1 size-4 rounded" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
