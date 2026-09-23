import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { DisputeDetailSkeleton } from "./_components/dispute-detail-skeleton";
import { DisputeListSkeleton } from "./_components/dispute-list-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminDisputesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-56 rounded-md" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <DisputeListSkeleton />
        <div className="hidden xl:block">
          <DisputeDetailSkeleton />
        </div>
      </div>
    </div>
  );
}
