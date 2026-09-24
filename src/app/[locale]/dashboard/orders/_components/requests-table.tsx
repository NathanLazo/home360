"use client";

import { LoaderCircleIcon, RadarIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { RadarRequestItem } from "./order.types";
import { useMoney } from "./use-money";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function RequestsTable({
  requests,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: {
  requests: RadarRequestItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (request: RadarRequestItem) => void;
}) {
  const t = useTranslations("dashboard.requests");
  const formatter = useFormatter();
  const money = useMoney();
  const columns: Array<DataTableColumn<RadarRequestItem>> = [
    {
      key: "title",
      mobile: "title",
      header: t("columns.request"),
      className: "min-w-64",
      cell: (request) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">{request.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {request.aiDiagnosis ?? t("noDiagnosis")}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      mobile: "meta",
      header: t("columns.category"),
      cell: (request) => <Badge variant="secondary">{request.category}</Badge>,
    },
    {
      key: "zone",
      mobile: "meta",
      header: t("columns.zone"),
      className: "min-w-36",
      cell: (request) => (
        <span className="text-muted-foreground">
          {request.zone.neighborhood ?? t("noZone")}
        </span>
      ),
    },
    {
      key: "distance",
      mobile: "trailing",
      header: t("columns.distance"),
      className: "text-right",
      cell: (request) => (
        <span className="block font-mono tabular-nums">
          {t("distanceValue", {
            km: formatter.number(request.distanceKm, {
              maximumFractionDigits: 1,
            }),
          })}
        </span>
      ),
    },
    {
      key: "range",
      mobile: "subtitle",
      header: t("columns.priceRange"),
      className: "min-w-40 text-right",
      cell: (request) =>
        request.aiMinPriceCents !== null && request.aiMaxPriceCents !== null ? (
          <span className="inline-flex items-center justify-end gap-1.5 font-mono tabular-nums">
            <SparklesIcon
              aria-hidden="true"
              className="text-muted-foreground size-3.5"
            />
            {t("priceRangeValue", {
              min: money(request.aiMinPriceCents),
              max: money(request.aiMaxPriceCents),
            })}
          </span>
        ) : (
          <span className="text-muted-foreground block">
            {t("notAvailable")}
          </span>
        ),
    },
    {
      key: "urgency",
      mobile: "status",
      header: t("columns.urgency"),
      cell: (request) =>
        request.aiUrgency ? (
          <Badge
            variant="outline"
            className={
              request.aiUrgency === "HIGH"
                ? "bg-error-soft text-error-deep border-transparent"
                : undefined
            }
          >
            {t(`urgency.${request.aiUrgency}`)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{t("notAvailable")}</span>
        ),
    },
    {
      key: "date",
      mobile: "meta",
      header: t("columns.date"),
      className: "min-w-32",
      cell: (request) => (
        <time
          dateTime={request.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm tabular-nums"
        >
          {formatter.relativeTime(request.createdAt)}
        </time>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={requests}
          onRowClick={onSelect}
          getRowId={(request) => request.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={RadarIcon}
                title={t("empty.title")}
                description={t("empty.description")}
              />
            </div>
          }
        />
      </CardContent>
      {hasMore ? (
        <div className="flex justify-center border-t p-4">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
