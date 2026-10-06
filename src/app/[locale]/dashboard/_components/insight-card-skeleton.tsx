import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export type InsightCardSkeletonProps = {
  label: string;
};

/** Loading shape shared by the funnel and activity cards. */
export function InsightCardSkeleton({ label }: InsightCardSkeletonProps) {
  return (
    <Card aria-busy="true" role="status">
      <CardHeader>
        <span className="sr-only">{label}</span>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 rounded-md" />
      </CardContent>
    </Card>
  );
}
