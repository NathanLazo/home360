"use client";

import {
  MapPinIcon,
  MapPinOffIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { CorporateLocationItem } from "../../_components/corporate.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Link } from "~/i18n/navigation";

const ACTIVITY_VARIANTS: Record<"active" | "inactive", StatusBadgeVariant> = {
  active: "success",
  inactive: "muted",
};

export type LocationsTableProps = {
  locations: CorporateLocationItem[];
  canMutate: boolean;
  deactivating: boolean;
  reactivating: boolean;
  notActiveTooltip: string;
  emptyAction: React.ReactNode;
  onEdit: (location: CorporateLocationItem) => void;
  onDeactivate: (location: CorporateLocationItem) => void;
  onReactivate: (location: CorporateLocationItem) => void;
};

export function LocationsTable({
  locations,
  canMutate,
  deactivating,
  reactivating,
  notActiveTooltip,
  emptyAction,
  onEdit,
  onDeactivate,
  onReactivate,
}: LocationsTableProps) {
  const t = useTranslations("corporate.locations");
  const formatter = useFormatter();

  const columns: Array<DataTableColumn<CorporateLocationItem>> = [
    {
      key: "name",
      header: t("table.name"),
      cell: (location) => (
        <span className="block max-w-48 truncate font-medium">
          {location.name}
        </span>
      ),
    },
    {
      key: "address",
      header: t("table.address"),
      cell: (location) => (
        <div className="flex max-w-64 flex-col gap-0.5">
          <span className="truncate">
            {location.addressLine}, {location.city}
          </span>
          {location.latitude === null || location.longitude === null ? (
            <span className="text-warning-deep text-copy-sm flex items-start gap-1 whitespace-normal">
              <MapPinOffIcon
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              {t("noCoordinates")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "contact",
      header: t("table.contact"),
      cell: (location) =>
        (location.contactName ?? location.contactPhone) ? (
          <span className="block max-w-44 truncate">
            {[location.contactName, location.contactPhone]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("noContact")}</span>
        ),
    },
    {
      key: "orders",
      header: t("table.orders"),
      className: "text-right",
      cell: (location) =>
        location.ordersCount > 0 ? (
          <Link
            href={{
              pathname: "/corporate/orders",
              query: { location: location.id },
            }}
            className="text-link-deep focus-visible:ring-ring rounded-xs font-mono tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t("ordersLink", {
              count: location.ordersCount,
              name: location.name,
            })}
          >
            {formatter.number(location.ordersCount)}
          </Link>
        ) : (
          <span className="text-muted-foreground font-mono tabular-nums">
            {formatter.number(location.ordersCount)}
          </span>
        ),
    },
    {
      key: "status",
      header: t("table.status"),
      cell: (location) => (
        <StatusBadge
          status={location.isActive ? "active" : "inactive"}
          variantMap={ACTIVITY_VARIANTS}
          label={location.isActive ? t("active") : t("inactive")}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("table.actions")}</span>,
      className: "text-right",
      cell: (location) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canMutate}
            title={canMutate ? undefined : notActiveTooltip}
            onClick={() => onEdit(location)}
          >
            <PencilIcon aria-hidden="true" />
            {t("edit")}
          </Button>
          {location.isActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-error-deep hover:text-error-deep"
              disabled={!canMutate || deactivating}
              title={canMutate ? undefined : notActiveTooltip}
              onClick={() => onDeactivate(location)}
            >
              <PowerOffIcon aria-hidden="true" />
              {t("deactivate")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canMutate || reactivating}
              title={canMutate ? undefined : notActiveTooltip}
              onClick={() => onReactivate(location)}
            >
              <PowerIcon aria-hidden="true" />
              {t("reactivate")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden py-0" aria-label={t("listLabel")}>
      <CardContent className="px-0">
        <DataTable
          columns={columns}
          data={locations}
          getRowId={(location) => location.id}
          emptyState={
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={MapPinIcon}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={emptyAction}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
