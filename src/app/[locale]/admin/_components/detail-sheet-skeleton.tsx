import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * Loading shape shared by the admin detail sheets (business, corporate
 * account): status badges, a facts list, then bordered-row sections.
 */
export function DetailSheetSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      <div className="flex gap-2" aria-hidden="true">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        {["w-40", "w-52", "w-28"].map((width) => (
          <div key={width} className="grid grid-cols-[6rem_1fr] gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className={`h-4 ${width}`} />
          </div>
        ))}
      </div>
      <Separator />
      <SectionSkeleton rows={2} />
      <Separator />
      <SectionSkeleton rows={3} />
    </div>
  );
}
