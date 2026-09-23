"use client";

import { MapPinIcon, PencilIcon, PowerOffIcon } from "lucide-react";
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

const ACTIVITY_VARIANTS: Record<"active" | "inactive", StatusBadgeVariant> = {
  active: "success",
  inactive: "muted",
};

export type LocationsTableProps = {
  locations: CorporateLocationItem[];
  canMutate: boolean;
  deactivating: boolean;
  notActiveTooltip: string;
  emptyAction: React.ReactNode;
  onEdit: (location: CorporateLocationItem) => void;
  onDeactivate: (location: CorporateLocationItem) => void;
};

export function LocationsTable({
  locations,
  canMutate,
  deactivating,
  notActiveTooltip,
  emptyAction,
  onEdit,
  onDeactivate,
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
        <span className="block max-w-64 truncate">
          {location.addressLine}, {location.city}
        </span>
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
      cell: (location) => (
        <span className="font-mono tabular-nums">
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
            className="min-h-11 sm:min-h-9"
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
              className="text-destructive hover:text-destructive min-h-11 sm:min-h-9"
              disabled={!canMutate || deactivating}
              title={canMutate ? undefined : notActiveTooltip}
              onClick={() => onDeactivate(location)}
            >
              <PowerOffIcon aria-hidden="true" />
              {t("deactivate")}
            </Button>
          ) : null}
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
