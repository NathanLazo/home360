import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4];

/**
 * Mirrors the real shape and height of the team screen (header + five table
 * rows) so hydration does not shift the layout.
 */
export function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-44" />
      </div>
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="flex h-12 items-center gap-4 border-b px-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
          {PLACEHOLDER_ROWS.map((row) => (
            <div
              key={row}
              className="flex h-[4.5rem] items-center gap-4 border-b px-4 last:border-b-0"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="size-10 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
