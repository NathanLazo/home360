import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { ReportListSkeleton } from "./_components/report-list-skeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function AdminReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-44 rounded-md" />
      <ReportListSkeleton />
    </div>
  );
}
