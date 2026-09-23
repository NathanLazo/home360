import { Skeleton } from "~/components/ui/skeleton";

/** Loading shape of `PageHeader`: title, subtitle and an optional action. */
export function PageHeaderSkeleton({
  withAction = false,
}: {
  withAction?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-10 w-40 rounded-md" /> : null}
    </div>
  );
}
