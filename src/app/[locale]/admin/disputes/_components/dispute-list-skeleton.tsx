import { Skeleton } from "~/components/ui/skeleton";

/** Loading shape of `DisputeListItem`: title + tone, parties, folio/amount, age. */
export function DisputeListSkeleton({
  count = 5,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="bg-card shadow-subtle flex flex-col gap-2.5 rounded-xl p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56 max-w-full" />
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
