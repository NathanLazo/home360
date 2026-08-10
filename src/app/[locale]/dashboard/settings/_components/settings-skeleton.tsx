import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

const PROFILE_FIELDS = [0, 1, 2, 3];
const ACCOUNT_FIELDS = [0, 1, 2, 3];

/** Same two-card shape and height as the settings screen: no layout shift. */
export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex max-w-[40rem] flex-col gap-6">
        <SkeletonCard fields={PROFILE_FIELDS} />
        <SkeletonCard fields={ACCOUNT_FIELDS} />
      </div>
    </div>
  );
}

function SkeletonCard({ fields }: { fields: number[] }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {fields.map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-36 self-end" />
      </CardContent>
    </Card>
  );
}
