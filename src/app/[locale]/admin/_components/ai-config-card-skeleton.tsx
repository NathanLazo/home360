import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

/** Loading shape of `AiConfigCard`: three label/value rows and the CTA. */
export function AiConfigCardSkeleton({ label }: { label?: string }) {
  return (
    <Card aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      <CardHeader className="grid-cols-[1fr_auto]" aria-hidden="true">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="col-start-2 row-span-2 row-start-1 size-4 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-3">
          {["w-12", "w-20", "w-32"].map((width) => (
            <div
              key={width}
              className="flex items-center justify-between gap-4"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className={`h-5 ${width}`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-10 w-full rounded-sm" />
      </CardContent>
    </Card>
  );
}
