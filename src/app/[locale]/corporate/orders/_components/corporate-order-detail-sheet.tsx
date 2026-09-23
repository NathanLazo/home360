"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateOrderDetailActions } from "./corporate-order-detail-actions";
import { CorporateOrderEvidence } from "./corporate-order-evidence";
import { CorporateOrderReceipt } from "./corporate-order-receipt";
import { CorporateOrderTimeline } from "./corporate-order-timeline";
import { CorporateOrderStatusBadge } from "../../_components/corporate-order-status-badge";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-copy-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

export type CorporateOrderDetailSheetProps = {
  orderId: string | null;
  canMutate: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: (orderId: string) => void;
  onConfirm: (orderId: string) => void;
  onDispute: (orderId: string) => void;
  onCancel: (orderId: string) => void;
};

/**
 * Full order file (`corporate.getOrder`): provider, location, timeline,
 * evidence and receipt, plus the actions the backend currently allows.
 */
export function CorporateOrderDetailSheet({
  orderId,
  canMutate,
  busy,
  onOpenChange,
  onPay,
  onConfirm,
  onDispute,
  onCancel,
}: CorporateOrderDetailSheetProps) {
  const t = useTranslations("corporate.orders.detail");
  const statusT = useTranslations("corporate.orderStatus");
  const typeT = useTranslations("corporate.orderType");
  const formatter = useFormatter();
  const query = api.corporate.getOrder.useQuery(
    { orderId: orderId ?? "" },
    { enabled: orderId !== null },
  );
  const state = unwrapEnvelope(query);

  return (
    <Sheet open={orderId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="pr-14">
          <SheetTitle>
            {state.status === "success" ? state.data.title : t("title")}
          </SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 min-h-11 min-w-11"
              aria-label={t("close")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {state.status === "pending" ? (
            <div className="flex flex-col gap-3" role="status" aria-busy="true">
              <span className="sr-only">{t("loading")}</span>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : null}

          {state.status === "error" ? (
            <SectionError
              title={t("errorTitle")}
              code={state.code}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {state.status === "success" ? (
            <>
              <dl className="flex flex-col gap-3">
                <DetailRow label={t("folio")}>
                  <span className="font-mono tabular-nums">
                    #{state.data.folio}
                  </span>
                </DetailRow>
                <DetailRow label={t("status")}>
                  <CorporateOrderStatusBadge
                    status={state.data.status}
                    label={statusT(state.data.status)}
                  />
                </DetailRow>
                <DetailRow label={t("type")}>
                  {typeT(state.data.type)}
                </DetailRow>
                <DetailRow label={t("business")}>
                  {state.data.business.name}
                </DetailRow>
                <DetailRow label={t("location")}>
                  {state.data.location?.name ?? t("noLocation")}
                </DetailRow>
                {state.data.worker ? (
                  <DetailRow label={t("worker")}>
                    {state.data.worker.fullName}
                  </DetailRow>
                ) : null}
                {state.data.quote?.scheduledFor ? (
                  <DetailRow label={t("scheduledFor")}>
                    {formatter.dateTime(state.data.quote.scheduledFor, {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </DetailRow>
                ) : null}
                <DetailRow label={t("created")}>
                  {formatter.dateTime(state.data.createdAt, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </DetailRow>
              </dl>

              <CorporateOrderDetailActions
                actions={state.data.actions}
                canMutate={canMutate}
                busy={busy}
                onPay={() => onPay(state.data.id)}
                onConfirm={() => onConfirm(state.data.id)}
                onDispute={() => onDispute(state.data.id)}
                onCancel={() => onCancel(state.data.id)}
              />

              {state.data.dispute ? (
                <p className="bg-warning-soft text-warning-deep text-copy-sm rounded-md px-3 py-2">
                  {t("disputeNotice")}
                </p>
              ) : null}

              <DetailSection title={t("receiptTitle")}>
                <CorporateOrderReceipt
                  amounts={state.data.amounts}
                  payment={state.data.payment}
                />
              </DetailSection>
              <DetailSection title={t("evidenceTitle")}>
                <CorporateOrderEvidence
                  evidence={state.data.evidence}
                  recording={state.data.recording}
                />
              </DetailSection>
              <DetailSection title={t("timelineTitle")}>
                <CorporateOrderTimeline events={state.data.timeline} />
              </DetailSection>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
