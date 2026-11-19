"use client";

import { useTranslations } from "next-intl";

import { OrdersPanel } from "./orders-panel";
import { useOrdersUrlState } from "./use-orders-url-state";
import { PageHeader } from "~/components/page-header";

/**
 * Orders workspace (web mirror of mobile N1): the business's order book.
 * Incoming service requests and own offers live in `/dashboard/requests`.
 */
export function OrdersView({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.orders");
  const urlState = useOrdersUrlState();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <OrdersPanel
        branchId={branchId}
        selectedOrderId={urlState.orderId}
        onOpenOrder={urlState.openOrder}
        onCloseOrder={urlState.closeOrder}
      />
    </div>
  );
}
