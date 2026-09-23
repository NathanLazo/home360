"use client";

import type { ReactNode } from "react";
import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PRESS_SURFACE_CLASS } from "../../_components/admin-motion";
import { DetailSheetSkeleton } from "../../_components/detail-sheet-skeleton";
import { BusinessStatusBadge } from "./business-status-badge";
import { GuaranteeBadge } from "./guarantee-badge";
import type { BusinessDetail } from "./users.types";
import { SectionError } from "~/components/section-error";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const documentStatusVariants: Record<
  BusinessDetail["documents"][number]["status"],
  StatusBadgeVariant
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const subscriptionStatusVariants: Record<string, StatusBadgeVariant> = {
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "muted",
};

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailBody({ detail }: { detail: BusinessDetail }) {
  const t = useTranslations("admin.users.detail");
  const typesT = useTranslations("admin.businessTypes");
  const orderStatusT = useTranslations("admin.orderStatus");
  const disputeStatusT = useTranslations("admin.disputeStatus");
  const documentTypeT = useTranslations("admin.documentTypes");
  const documentStatusT = useTranslations("admin.documentStatus");
  const formatter = useFormatter();

  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <BusinessStatusBadge status={detail.derivedStatus} />
        <Badge variant="outline" className="font-normal">
          {typesT(detail.type)}
        </Badge>
      </div>

      {detail.statusReason ? (
        <p className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
          {t("statusReason", { reason: detail.statusReason })}
        </p>
      ) : null}

      <DetailSection title={t("owner")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("ownerName")}</dt>
          <dd className="min-w-0">{detail.ownerName ?? t("notAvailable")}</dd>
          <dt className="text-muted-foreground">{t("ownerEmail")}</dt>
          <dd className="min-w-0 truncate">
            {detail.ownerEmail ?? t("notAvailable")}
          </dd>
          <dt className="text-muted-foreground">{t("registeredAt")}</dt>
          <dd suppressHydrationWarning>
            {formatter.dateTime(detail.createdAt, { dateStyle: "medium" })}
          </dd>
        </dl>
      </DetailSection>

      <Separator />

      <DetailSection title={t("guarantee")}>
        <GuaranteeBadge guaranteeType={detail.guaranteeType} />
        {detail.guaranteeNotes ? (
          <p className="text-muted-foreground text-sm">
            {detail.guaranteeNotes}
          </p>
        ) : null}
      </DetailSection>

      <Separator />

      <DetailSection title={t("documents")}>
        {detail.documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noDocuments")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <FileTextIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {documentTypeT(document.type)}
                  </span>
                  {document.notes ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {document.notes}
                    </span>
                  ) : null}
                </div>
                <StatusBadge
                  status={document.status}
                  variantMap={documentStatusVariants}
                  label={documentStatusT(document.status)}
                />
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={t("openDocument")}
                >
                  <ExternalLinkIcon aria-hidden="true" className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title={t("subscription")}>
        {detail.subscription ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="font-normal">
              {detail.subscription.planCode}
            </Badge>
            <StatusBadge
              status={detail.subscription.status}
              variantMap={subscriptionStatusVariants}
              label={detail.subscription.status}
            />
            <span className="text-muted-foreground" suppressHydrationWarning>
              {t("renewsAt", {
                date: formatter.dateTime(detail.subscription.renewsAt, {
                  dateStyle: "medium",
                }),
              })}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noSubscription")}</p>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title={t("recentOrders", { count: detail.ordersCount })}>
        {detail.recentOrders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noOrders")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{order.title}</span>
                  <span className="text-muted-foreground text-xs">
                    #{order.folio} · {orderStatusT(order.status)}
                  </span>
                </div>
                <span className="font-mono font-semibold tabular-nums">
                  {currency(order.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <Separator />

      <DetailSection
        title={t("disputes", { count: detail.disputes.openCount })}
      >
        {detail.disputes.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noDisputes")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.disputes.items.map((dispute) => (
              <li key={dispute.id}>
                <Link
                  href={`/admin/disputes?dispute=${dispute.id}`}
                  className={cn(
                    "focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-zinc-50 focus-visible:ring-2 focus-visible:outline-none",
                    PRESS_SURFACE_CLASS,
                  )}
                >
                  <span className="truncate font-medium">{dispute.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {disputeStatusT(dispute.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </div>
  );
}

export type BusinessDetailSheetProps = {
  businessId: string | null;
  onClose: () => void;
  actionsSlot?: (detail: BusinessDetail) => ReactNode;
};

export function BusinessDetailSheet({
  businessId,
  onClose,
  actionsSlot,
}: BusinessDetailSheetProps) {
  const t = useTranslations("admin.users.detail");
  const query = api.admin.users.getBusinessDetail.useQuery(
    { businessId: businessId ?? "" },
    { enabled: businessId !== null },
  );
  const state = unwrapEnvelope(query);

  return (
    <Sheet
      open={businessId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {state.status === "success" ? state.data.name : t("title")}
          </SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {state.status === "pending" ? (
            <DetailSheetSkeleton label={t("loading")} />
          ) : null}

          {state.status === "error" ? (
            <SectionError
              title={t("errorTitle")}
              code={state.code}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {state.status === "success" ? (
            <DetailBody detail={state.data} />
          ) : null}
        </div>

        {state.status === "success" && actionsSlot ? (
          <SheetFooter className="border-t">
            {actionsSlot(state.data)}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
