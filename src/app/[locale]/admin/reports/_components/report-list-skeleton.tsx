import { Skeleton } from "~/components/ui/skeleton";

/** Loading shape of `ReportCard`: reason + age, quoted message, parties, actions. */
export function ReportListSkeleton({
  count = 4,
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
          className="bg-card shadow-subtle flex flex-col gap-3 rounded-xl p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
