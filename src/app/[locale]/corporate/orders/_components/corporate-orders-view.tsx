"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrderStatus } from "@generated/prisma";
import { CorporateOrderDetailSheet } from "./corporate-order-detail-sheet";
import { CorporateOrderFilters } from "./corporate-order-filters";
import { CorporateOrderRowActions } from "./corporate-order-row-actions";
import { CorporateOrdersTable } from "./corporate-orders-table";
import { CorporateRequestsSection } from "./corporate-requests-section";
import { NewRequestSheet } from "./new-request-sheet";
import { OpenDisputeDialog } from "./open-dispute-dialog";
import { RequestReworkDialog } from "./request-rework-dialog";
import { useCorporateOrderActions } from "./use-corporate-order-actions";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { TableSkeleton } from "~/components/table-skeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { usePathname, useRouter } from "~/i18n/navigation";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type CorporateOrdersViewProps = {
  locationId?: string;
  status?: OrderStatus;
  orderId?: string;
};

/**
 * Corporate consumer workspace: raise requests from a location, compare and
 * accept offers, pay into escrow and follow the consolidated orders. The
 * open order detail lives in `?order=<id>` so it is linkable from the
 * overview and survives a refresh.
 */
export function CorporateOrdersView({
  locationId,
  status,
  orderId,
}: CorporateOrdersViewProps) {
  const t = useTranslations("corporate.orders");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const actions = useCorporateOrderActions();
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);
  const [reworkOrderId, setReworkOrderId] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  const listInput = {
    ...(locationId ? { locationId } : {}),
    ...(status ? { status } : {}),
  };
  const listQuery = api.corporate.listOrders.useInfiniteQuery(listInput, {
    getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
  });
  const locationsQuery = api.corporate.listLocations.useQuery({
    includeInactive: true,
  });
  const membershipQuery = api.corporate.getMembership.useQuery();
  // Mutations are `activeCorporateProcedure` server-side; mirror it so the
  // UI never invites actions that will be refused.
  const canMutate = membershipQuery.data?.result?.status === "ACTIVE";

  const pages = listQuery.data?.pages;
  const responseError =
    pages?.find((page) => page.error !== null)?.error ?? null;
  const errorCode =
    responseError ?? (listQuery.error ? toErrorCode(listQuery.error) : null);
  const orders =
    pages?.flatMap((page) =>
      page.error === null ? (page.result?.items ?? []) : [],
    ) ?? [];
  const allLocations = locationsQuery.data?.result?.items ?? [];
  const filterLocations = allLocations.map(({ id, name }) => ({ id, name }));
  const activeLocations = allLocations
    .filter((location) => location.isActive)
    .map(({ id, name }) => ({ id, name }));
  const busy =
    actions.paying ||
    actions.confirming ||
    actions.cancelling ||
    actions.disputing ||
    actions.reworking;

  function setOrderParam(nextOrderId: string | null) {
    const next = new URLSearchParams(searchParams.toString());

    if (nextOrderId === null) {
      next.delete("order");
    } else {
      next.set("order", nextOrderId);
    }

    const query = next.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  async function acceptQuote(quoteId: string) {
    const newOrderId = await actions.acceptQuote(quoteId);

    if (newOrderId) {
      setOrderParam(newOrderId);
    }
  }

  const newRequestButton = canMutate ? (
    <Button
      type="button"
      beam
      beamActive={!newRequestOpen}
      className="min-h-11 sm:min-h-10"
      disabled={activeLocations.length === 0}
      title={activeLocations.length === 0 ? t("needLocation") : undefined}
      onClick={() => setNewRequestOpen(true)}
    >
      <PlusIcon aria-hidden="true" />
      {t("newRequest.open")}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={newRequestButton}
      />

      <CorporateRequestsSection
        locationId={locationId}
        canMutate={canMutate}
        accepting={actions.acceptingQuote}
        paying={actions.paying}
        emptyAction={
          canMutate && activeLocations.length > 0 ? (
            <Button type="button" onClick={() => setNewRequestOpen(true)}>
              <PlusIcon aria-hidden="true" />
              {t("newRequest.open")}
            </Button>
          ) : undefined
        }
        onAccept={(quoteId) => void acceptQuote(quoteId)}
        onPay={(id) => void actions.pay(id)}
        onViewOrder={setOrderParam}
      />

      <section
        aria-labelledby="corporate-orders-title"
        className="flex flex-col gap-3"
      >
        <h2 id="corporate-orders-title" className="text-display-sm">
          {t("ordersTitle")}
        </h2>
        <CorporateOrderFilters
          locations={filterLocations}
          locationId={locationId}
          status={status}
        />

        {listQuery.isPending ? (
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0">
              <TableSkeleton columns={8} rows={8} label={t("loading")} />
            </CardContent>
          </Card>
        ) : null}

        {!listQuery.isPending && errorCode !== null ? (
          <SectionError
            title={t("queryErrorTitle")}
            code={errorCode}
            onRetry={() => void listQuery.refetch()}
          />
        ) : null}

        {!listQuery.isPending && errorCode === null ? (
          <CorporateOrdersTable
            orders={orders}
            filtered={locationId !== undefined || status !== undefined}
            hasMore={Boolean(listQuery.hasNextPage)}
            loadingMore={listQuery.isFetchingNextPage}
            onLoadMore={() => void listQuery.fetchNextPage()}
            onSelect={(order) => setOrderParam(order.id)}
            renderActions={(order) => (
              <CorporateOrderRowActions
                order={order}
                busy={busy}
                onView={setOrderParam}
                onConfirm={setConfirmOrderId}
                onDispute={setDisputeOrderId}
                onCancel={setCancelOrderId}
              />
            )}
          />
        ) : null}
      </section>

      <CorporateOrderDetailSheet
        orderId={orderId ?? null}
        canMutate={canMutate}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setOrderParam(null);
        }}
        onPay={(id) => void actions.pay(id)}
        onConfirm={setConfirmOrderId}
        onRework={setReworkOrderId}
        onDispute={setDisputeOrderId}
        onCancel={setCancelOrderId}
      />

      <NewRequestSheet
        open={newRequestOpen}
        locations={activeLocations}
        defaultLocationId={locationId}
        submitting={actions.creatingRequest}
        onOpenChange={setNewRequestOpen}
        onSubmit={actions.createRequest}
      />

      <RequestReworkDialog
        open={reworkOrderId !== null}
        submitting={actions.reworking}
        onOpenChange={(open) => {
          if (!open) setReworkOrderId(null);
        }}
        onSubmit={(note) =>
          reworkOrderId
            ? actions.requestRework({ orderId: reworkOrderId, note })
            : Promise.resolve(false)
        }
      />

      <OpenDisputeDialog
        open={disputeOrderId !== null}
        submitting={actions.disputing}
        onOpenChange={(open) => {
          if (!open) setDisputeOrderId(null);
        }}
        onSubmit={(input) =>
          disputeOrderId
            ? actions.openDispute({ orderId: disputeOrderId, ...input })
            : Promise.resolve(false)
        }
      />

      <ConfirmDialog
        open={confirmOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmOrderId(null);
        }}
        title={t("confirmDialog.title")}
        description={t("confirmDialog.description")}
        confirmLabel={t("confirmDialog.confirm")}
        cancelLabel={t("confirmDialog.cancel")}
        decisive
        loading={actions.confirming}
        onConfirm={() => {
          if (!confirmOrderId) return;
          void actions.confirmDelivery(confirmOrderId).then((succeeded) => {
            if (succeeded) setConfirmOrderId(null);
          });
        }}
      />

      <ConfirmDialog
        open={cancelOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelOrderId(null);
        }}
        title={t("cancelDialog.title")}
        description={t("cancelDialog.description")}
        confirmLabel={t("cancelDialog.confirm")}
        cancelLabel={t("cancelDialog.cancel")}
        destructive
        loading={actions.cancelling}
        onConfirm={() => {
          if (!cancelOrderId) return;
          void actions.cancelOrder(cancelOrderId).then((succeeded) => {
            if (succeeded) setCancelOrderId(null);
          });
        }}
      />
    </div>
  );
}
