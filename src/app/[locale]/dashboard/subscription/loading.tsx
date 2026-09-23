import { Skeleton } from "~/components/ui/skeleton";

export default function SubscriptionLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-80 w-full rounded-md" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-md" />
    </div>
  );
}
