import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

const SECTION_FIELD_COUNTS = [3, 3, 1, 2];

/**
 * Loading shape of the settings form: one card per section (title + icon,
 * description, label/input pairs) and the sticky save bar.
 */
export function SettingsSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      {SECTION_FIELD_COUNTS.map((fields, sectionIndex) => (
        <Card key={sectionIndex} aria-hidden="true">
          <CardHeader className="grid-cols-[1fr_auto]">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="col-start-2 row-span-2 row-start-1 size-4 rounded" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Skeleton className="h-4 w-full max-w-lg" />
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: fields }, (_, fieldIndex) => (
                <div key={fieldIndex} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-sm" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div
        className="bg-card shadow-float flex items-center justify-between gap-3 rounded-2xl p-3"
        aria-hidden="true"
      >
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-sm" />
          <Skeleton className="h-10 w-36 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
