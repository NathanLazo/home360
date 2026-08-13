"use client";

import { ArrowRightIcon, InboxIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateOrderStatusBadge } from "./corporate-order-status-badge";
import type { CorporateOrderItem } from "./corporate.types";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "~/i18n/navigation";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export type RecentCorporateOrdersProps = {
  limit: number;
};

export function RecentCorporateOrders({ limit }: RecentCorporateOrdersProps) {
  const t = useTranslations("corporate.home");
  const ordersT = useTranslations("corporate.orders.table");
  const statusT = useTranslations("corporate.orderStatus");
  const formatter = useFormatter();
  const query = api.corporate.listOrders.useQuery({ limit });
  const state = unwrapEnvelope(query);

  const columns: Array<DataTableColumn<CorporateOrderItem>> = [
    {
      key: "folio",
      header: ordersT("folio"),
      cell: (order) => (
        <span className="font-mono text-xs tabular-nums">#{order.folio}</span>
      ),
    },
    {
      key: "order",
      header: ordersT("order"),
      cell: (order) => (
        <span className="block max-w-56 truncate font-medium">
          {order.title}
        </span>
      ),
    },
    {
      key: "location",
      header: ordersT("location"),
      cell: (order) =>
        order.location ? (
          <span className="block max-w-40 truncate">{order.location.name}</span>
        ) : (
          <span className="text-muted-foreground">{ordersT("noLocation")}</span>
        ),
    },
    {
      key: "amount",
      header: ordersT("amount"),
      className: "text-right",
      cell: (order) => (
        <span className="font-mono tabular-nums">
          {formatter.number(order.amountCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: ordersT("status"),
      cell: (order) => (
        <CorporateOrderStatusBadge
          status={order.status}
          label={statusT(order.status)}
        />
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recentTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.status === "pending" ? (
          <div className="flex flex-col gap-3" aria-busy="true" role="status">
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : null}

        {state.status === "error" ? (
          <SectionError
            title={t("queryErrorTitle")}
            code={state.code}
            onRetry={() => void query.refetch()}
          />
        ) : null}

        {state.status === "success" ? (
          <>
            <DataTable
              columns={columns}
              data={state.data.items}
              emptyState={
                <EmptyState
                  icon={InboxIcon}
                  title={t("recentEmptyTitle")}
                  description={t("recentEmptyDescription")}
                  action={
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href="/corporate/locations">
                        {t("recentEmptyAction")}
                      </Link>
                    </Button>
                  }
                />
              }
            />
            {state.data.items.length > 0 ? (
              <Button
                asChild
                variant="ghost"
                className="min-h-11 self-start sm:min-h-9"
              >
                <Link href="/corporate/orders">
                  {t("viewAll")}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
