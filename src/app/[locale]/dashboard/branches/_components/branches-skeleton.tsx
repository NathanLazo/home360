import { Skeleton } from "~/components/ui/skeleton";

/**
 * Mirrors the branches screen (header and card grid) so the swap from
 * route loading to data does not shift the layout.
 */
export function BranchesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
