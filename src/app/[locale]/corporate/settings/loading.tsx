import { Skeleton } from "~/components/ui/skeleton";

export default function CorporateSettingsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
