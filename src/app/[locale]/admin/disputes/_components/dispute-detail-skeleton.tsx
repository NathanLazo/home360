import { Skeleton } from "~/components/ui/skeleton";

/**
 * Loading shape of the dispute file in reading order: heading, recording,
 * payment strip, arguments and the resolution buttons.
 */
export function DisputeDetailSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-6 w-72 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="aspect-video w-full rounded-lg" />
      </div>
      <div
        className="grid grid-cols-2 gap-4 rounded-xl border p-6 sm:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {["w-36", "w-40", "w-32", "w-44"].map((width) => (
          <Skeleton key={width} className={`h-10 rounded-sm ${width}`} />
        ))}
      </div>
    </div>
  );
}
