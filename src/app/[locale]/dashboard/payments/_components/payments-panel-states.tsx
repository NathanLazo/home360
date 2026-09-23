"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TableSkeleton } from "~/components/table-skeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

/** Skeleton shaped like the tab's table (same column count, real rows). */
export function PaymentsPanelLoading({
  label,
  columns,
}: {
  label: string;
  columns: number;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <TableSkeleton columns={columns} rows={8} label={label} />
      </CardContent>
    </Card>
  );
}

export function PaymentsLoadMore({
  loading,
  onLoadMore,
}: {
  loading: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("dashboard.payments");

  return (
    <div className="flex justify-center border-t p-4">
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {t("loadMore")}
      </Button>
    </div>
  );
}
