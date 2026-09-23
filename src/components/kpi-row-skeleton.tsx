import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

export type KpiRowSkeletonProps = {
  /** Number of placeholder cards; match the real row. */
  count?: number;
  /**
   * Announced to assistive tech while loading. Omit it inside a route
   * `loading.tsx` whose wrapper already carries `aria-busy`.
   */
  label?: string;
  className?: string;
};

/**
 * Loading state shaped like a row of `KpiCard`s (label + icon, figure, hint)
 * so the layout does not jump when data lands.
 */
export function KpiRowSkeleton({
  count = 4,
  label,
  className,
}: KpiRowSkeletonProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-busy="true"
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}
    >
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardHeader className="grid-cols-[1fr_auto]">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded-sm" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
