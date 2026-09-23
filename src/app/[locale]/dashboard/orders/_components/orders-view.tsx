"use client";

import { useTranslations } from "next-intl";

import { OffersPanel } from "./offers-panel";
import { ordersTabSchema } from "./orders.schema";
import { OrdersPanel } from "./orders-panel";
import { RequestsPanel } from "./requests-panel";
import { useOrdersUrlState } from "./use-orders-url-state";
import { PageHeader } from "~/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

/**
 * Orders workspace (web mirror of mobile N1/N2): the order book, the radar of
 * incoming service requests and the business's own offers, one tab each.
 */
export function OrdersView({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.orders");
  const urlState = useOrdersUrlState();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Tabs
        value={urlState.tab}
        onValueChange={(value) => {
          const parsed = ordersTabSchema.safeParse(value);
          if (parsed.success) urlState.setTab(parsed.data);
        }}
        className="gap-6"
      >
        <TabsList
          animatedIndicator
          className="max-w-full justify-start overflow-x-auto"
          aria-label={t("tabs.label")}
        >
          {ordersTabSchema.options.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-h-9 px-3">
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="orders" className="flex flex-col gap-6">
          <OrdersPanel
            branchId={branchId}
            selectedOrderId={urlState.orderId}
            onOpenOrder={urlState.openOrder}
            onCloseOrder={urlState.closeOrder}
          />
        </TabsContent>
        <TabsContent value="requests" className="flex flex-col gap-6">
          <RequestsPanel
            branchId={branchId}
            selectedRequestId={urlState.requestId}
            onOpenRequest={urlState.openRequest}
            onCloseRequest={urlState.closeRequest}
          />
        </TabsContent>
        <TabsContent value="offers" className="flex flex-col gap-6">
          <OffersPanel
            selectedRequestId={urlState.requestId}
            onOpenRequest={urlState.openRequest}
            onCloseRequest={urlState.closeRequest}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
