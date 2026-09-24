"use client";

import { LoaderCircleIcon, WrenchIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ServiceRowActions } from "./service-row-actions";
import { ServiceStatusBadge } from "./service-status-badge";
import type { ServiceListItem } from "./service.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function ServicesTable({
  services,
  filtered,
  readOnly,
  hasMore,
  loadingMore,
  mutationBusy,
  onLoadMore,
  onCreate,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  services: ServiceListItem[];
  /** True when search/category/status filters are narrowing the list. */
  filtered: boolean;
  readOnly: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  mutationBusy: boolean;
  onLoadMore: () => void;
  onCreate: () => void;
  onEdit: (service: ServiceListItem) => void;
  onStatusChange: (service: ServiceListItem) => Promise<boolean>;
  onDelete: (service: ServiceListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.services");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const formatter = useFormatter();
  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const duration = (minimum: number, maximum: number | null) => {
    const format = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (hours && rest)
        return t("duration.hoursMinutes", { hours, minutes: rest });
      if (hours) return t("duration.hours", { count: hours });
      return t("duration.minutes", { count: rest });
    };
    return maximum ? `${format(minimum)}–${format(maximum)}` : format(minimum);
  };
  const columns: Array<DataTableColumn<ServiceListItem>> = [
    {
      key: "name",
      mobile: "title",
      header: t("columns.service"),
      className: "min-w-60",
      cell: (service) => (
        <span className="flex items-center gap-3 font-medium">
          <span className="bg-canvas-soft shadow-hairline flex size-9 shrink-0 items-center justify-center rounded-sm">
            <WrenchIcon aria-hidden="true" className="size-4" />
          </span>
          {service.name}
        </span>
      ),
    },
    {
      key: "category",
      mobile: "meta",
      header: t("columns.category"),
      cell: (service) => (
        <span className="text-muted-foreground">{service.category}</span>
      ),
    },
    {
      key: "price",
      mobile: "trailing",
      header: t("columns.price"),
      className: "text-right",
      cell: (service) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(service.basePriceCents)}
        </span>
      ),
    },
    {
      key: "duration",
      mobile: "meta",
      header: t("columns.duration"),
      cell: (service) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {duration(service.durationMinutes, service.durationMaxMinutes)}
        </span>
      ),
    },
    {
      key: "workers",
      mobile: "subtitle",
      header: t("columns.workers"),
      className: "min-w-48 max-w-72",
      cell: (service) =>
        service.workers.length ? (
          <span className="text-muted-foreground block truncate">
            {service.workers.map((worker) => worker.fullName).join(", ")}
          </span>
        ) : (
          <span className="text-muted-foreground italic">
            {t("unassigned")}
          </span>
        ),
    },
    {
      key: "status",
      mobile: "status",
      header: t("columns.status"),
      cell: (service) => (
        <ServiceStatusBadge
          status={service.status}
          label={t(`status.${service.status}`)}
        />
      ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-14 text-right",
      cell: (service) => (
        <ServiceRowActions
          service={service}
          busy={mutationBusy}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={services}
          emptyState={
            <div className="p-6">
              <EmptyState
                icon={WrenchIcon}
                title={t(filtered ? "empty.filteredTitle" : "empty.title")}
                description={t(
                  filtered ? "empty.filteredDescription" : "empty.description",
                )}
                action={
                  filtered ? undefined : (
                    <Button
                      type="button"
                      onClick={onCreate}
                      disabled={readOnly}
                      title={readOnly ? readOnlyT("actionDisabled") : undefined}
                    >
                      {t("newService")}
                    </Button>
                  )
                }
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
