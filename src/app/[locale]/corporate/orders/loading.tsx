import { Skeleton } from "~/components/ui/skeleton";

export default function CorporateOrdersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-11 w-full rounded-lg sm:h-10 sm:w-56" />
        <Skeleton className="h-11 w-full rounded-lg sm:h-10 sm:w-44" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
