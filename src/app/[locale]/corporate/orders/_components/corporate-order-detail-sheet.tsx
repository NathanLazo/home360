"use client";

import { XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CorporateOrderStatusBadge } from "../../_components/corporate-order-status-badge";
import type { CorporateOrderItem } from "../../_components/corporate.types";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-copy-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

export type CorporateOrderDetailSheetProps = {
  open: boolean;
  order: CorporateOrderItem | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Detail of a consolidated row. Everything shown comes from the already
 * loaded list item — the corporate contract exposes no per-order endpoint,
 * and inventing one here would leak provider internals the account does not
 * need.
 */
export function CorporateOrderDetailSheet({
  open,
  order,
  onOpenChange,
}: CorporateOrderDetailSheetProps) {
  const t = useTranslations("corporate.orders.detail");
  const statusT = useTranslations("corporate.orderStatus");
  const typeT = useTranslations("corporate.orderType");
  const formatter = useFormatter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="pr-14">
          <SheetTitle>{order ? order.title : t("title")}</SheetTitle>
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
        {order ? (
          <dl className="flex flex-col gap-3 px-4 pb-6">
            <DetailRow label={t("folio")}>
              <span className="font-mono tabular-nums">#{order.folio}</span>
            </DetailRow>
            <DetailRow label={t("business")}>{order.businessName}</DetailRow>
            <DetailRow label={t("location")}>
              {order.location ? order.location.name : t("noLocation")}
            </DetailRow>
            <DetailRow label={t("type")}>{typeT(order.type)}</DetailRow>
            <DetailRow label={t("status")}>
              <CorporateOrderStatusBadge
                status={order.status}
                label={statusT(order.status)}
              />
            </DetailRow>
            <DetailRow label={t("amount")}>
              <span className="font-mono tabular-nums">
                {formatter.number(order.amountCents / 100, {
                  style: "currency",
                  currency: "MXN",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </DetailRow>
            <DetailRow label={t("created")}>
              {formatter.dateTime(order.createdAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </DetailRow>
          </dl>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
