"use client";

import type { ReactNode } from "react";
import { ReceiptTextIcon, ScaleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppFormatter } from "~/i18n/use-app-formatter";

import { AdminOrderStatusBadge } from "./admin-order-status-badge";
import { AdminOrderTypeBadge } from "./admin-order-type-badge";
import type { AdminOrderRow } from "./admin-orders.types";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";

/** Every order of the platform; a row opens its file in the detail sheet. */
export function AdminOrdersTable({
  orders,
  filtered,
  onOpenOrder,
  emptyAction,
}: {
  orders: AdminOrderRow[];
  filtered: boolean;
  onOpenOrder: (orderId: string) => void;
  emptyAction?: ReactNode;
}) {
  const t = useTranslations("admin.orders");
  const paymentT = useTranslations("admin.paymentStatus");
  const formatter = useAppFormatter();
  const currency = useCurrencyFormatter();

  const columns: Array<DataTableColumn<AdminOrderRow>> = [
    {
      key: "folio",
      mobile: "meta",
      header: t("columns.folio"),
      className: "w-24",
      cell: (row) => (
        <span className="font-mono font-semibold tabular-nums">
          #{row.folio}
        </span>
      ),
    },
    {
      key: "order",
      mobile: "title",
      header: t("columns.order"),
      className: "min-w-56",
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "type",
      header: t("columns.type"),
      cell: (row) => (
        <AdminOrderTypeBadge
          type={row.type}
          fulfillmentMethod={row.fulfillmentMethod}
        />
      ),
    },
    {
      key: "customer",
      mobile: "meta",
      header: t("columns.customer"),
      className: "min-w-36",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.customer.name ?? t("notAvailable")}
        </span>
      ),
    },
    {
      key: "business",
      mobile: "subtitle",
      header: t("columns.business"),
      className: "min-w-36",
      cell: (row) => (
        <span className="text-muted-foreground">{row.business.name}</span>
      ),
    },
    {
      key: "amount",
      mobile: "trailing",
      header: <span className="block text-right">{t("columns.amount")}</span>,
      className: "text-right",
      cell: (row) => (
        <span className="block font-mono font-semibold tabular-nums">
          {currency(row.amountCents)}
        </span>
      ),
    },
    {
      key: "payment",
      header: t("columns.payment"),
      className: "min-w-32",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className="text-muted-foreground text-copy-sm">
            {row.paymentStatus ? paymentT(row.paymentStatus) : t("noPayment")}
          </span>
          {row.dispute ? (
            <span className="text-error-deep inline-flex items-center gap-1 text-xs font-medium">
              <ScaleIcon aria-hidden="true" className="size-3.5" />
              {t("disputeChip")}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      mobile: "status",
      header: t("columns.status"),
      cell: (row) => <AdminOrderStatusBadge status={row.status} />,
    },
    {
      key: "date",
      mobile: "meta",
      header: t("columns.date"),
      className: "min-w-28",
      cell: (row) => (
        <time
          dateTime={row.createdAt.toISOString()}
          className="text-muted-foreground text-copy-sm tabular-nums"
        >
          {formatter.dateTime(row.createdAt, "shortDate")}
        </time>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={orders}
      getRowId={(row) => row.id}
      onRowClick={(row) => onOpenOrder(row.id)}
      emptyState={
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={ReceiptTextIcon}
            title={t(filtered ? "empty.filteredTitle" : "empty.title")}
            description={t(
              filtered ? "empty.filteredDescription" : "empty.description",
            )}
            action={emptyAction}
          />
        </div>
      }
    />
  );
}
