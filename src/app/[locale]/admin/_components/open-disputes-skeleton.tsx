import { Skeleton } from "~/components/ui/skeleton";

/** Loading shape of `OpenDisputesList`: badge + title, parties, age, amount. */
export function OpenDisputesSkeleton({
  count = 3,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="bg-card shadow-subtle flex items-center gap-4 rounded-md p-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}
