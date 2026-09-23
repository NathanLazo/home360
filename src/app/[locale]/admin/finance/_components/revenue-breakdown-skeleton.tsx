import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

const BAR_HEIGHTS = ["h-24", "h-32", "h-28", "h-40", "h-36", "h-44"];

/**
 * Loading shape of the revenue row: a six-month bar chart card and the
 * donut + ledger card beside it, in the same grid cells.
 */
export function RevenueBreakdownSkeleton({ label }: { label?: string }) {
  return (
    <>
      <Card aria-busy="true" role="status">
        {label ? <span className="sr-only">{label}</span> : null}
        <CardHeader aria-hidden="true">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3" aria-hidden="true">
          <div className="flex h-64 items-end justify-between gap-3 border-b pb-2 sm:h-72">
            {BAR_HEIGHTS.map((height, index) => (
              <Skeleton key={index} className={`w-full rounded-sm ${height}`} />
            ))}
          </div>
          <div className="flex justify-center gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="mx-auto aspect-square w-full max-w-52 rounded-full" />
          {["w-24", "w-20", "w-16"].map((width) => (
            <div
              key={width}
              className="flex items-center justify-between gap-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className={`h-4 ${width}`} />
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
