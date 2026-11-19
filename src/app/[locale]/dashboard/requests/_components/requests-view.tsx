"use client";

import { useTranslations } from "next-intl";

import { OffersPanel } from "./offers-panel";
import { requestsTabSchema } from "./requests.schema";
import { RequestsPanel } from "./requests-panel";
import { useRequestsUrlState } from "./use-requests-url-state";
import { PageHeader } from "~/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

/**
 * Requests workspace (web mirror of mobile N2): the radar of incoming service
 * requests and the business's own offers. Accepted offers become orders.
 */
export function RequestsView({ branchId }: { branchId?: string }) {
  const t = useTranslations("dashboard.requestsPage");
  const urlState = useRequestsUrlState();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Tabs
        value={urlState.tab}
        onValueChange={(value) => {
          const parsed = requestsTabSchema.safeParse(value);
          if (parsed.success) urlState.setTab(parsed.data);
        }}
        className="gap-6"
      >
        <TabsList
          animatedIndicator
          className="max-w-full justify-start overflow-x-auto overflow-y-hidden"
          aria-label={t("tabs.label")}
        >
          {requestsTabSchema.options.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="px-3">
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="radar" className="flex flex-col gap-6">
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
