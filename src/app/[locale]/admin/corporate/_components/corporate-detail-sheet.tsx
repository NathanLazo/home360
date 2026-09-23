"use client";

import type { ReactNode } from "react";
import { MapPinIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { isDormantCorporate } from "./corporate-dormancy";
import { CorporateStatusBadge } from "./corporate-status-badge";
import { CorporateTierBadge } from "./corporate-tier-badge";
import type { CorporateAccountDetail } from "./corporate.types";
import { CopyIdButton } from "../../_components/copy-id-button";
import { DetailSheetSkeleton } from "../../_components/detail-sheet-skeleton";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
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
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";
import { UserAvatar } from "~/components/user-avatar";

const membershipStatusVariants: Record<
  NonNullable<CorporateAccountDetail["membership"]>["status"],
  StatusBadgeVariant
> = {
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

function DetailBody({
  detail,
  requestsSlot,
}: {
  detail: CorporateAccountDetail;
  requestsSlot: ReactNode;
}) {
  const t = useTranslations("admin.corporate.detail");
  const orderStatusT = useTranslations("admin.orderStatus");
  const membershipT = useTranslations("admin.corporate.membershipStatus");
  const formatter = useFormatter();
  const currency = useCurrencyFormatter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <CorporateStatusBadge status={detail.status} />
        <CorporateTierBadge tier={detail.tier} />
      </div>

      {detail.statusReason ? (
        <p className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
          {t("statusReason", { reason: detail.statusReason })}
        </p>
      ) : null}

      <DetailSection title={t("terms")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("commission")}</dt>
          <dd className="tabular-nums">{detail.commissionPct}%</dd>
          <dt className="text-muted-foreground">{t("monthlyFee")}</dt>
          <dd className="font-mono tabular-nums">
            {currency(detail.monthlyFeeCents)}
          </dd>
          <dt className="text-muted-foreground">{t("maxLocations")}</dt>
          <dd className="tabular-nums">
            {detail.maxLocations ?? t("unlimited")}
          </dd>
          <dt className="text-muted-foreground">{t("manager")}</dt>
          <dd className="truncate">
            {detail.accountManager?.name ??
              detail.accountManager?.email ??
              t("notAvailable")}
          </dd>
          <dt className="text-muted-foreground">{t("taxId")}</dt>
          <dd className="truncate">{detail.taxId ?? t("notAvailable")}</dd>
          <dt className="text-muted-foreground">{t("createdAt")}</dt>
          <dd suppressHydrationWarning>
            {formatter.dateTime(detail.createdAt, { dateStyle: "medium" })}
          </dd>
        </dl>
      </DetailSection>

      <Separator />

      <DetailSection title={t("owner")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("ownerName")}</dt>
          <dd className="truncate">{detail.owner.name ?? t("notAvailable")}</dd>
          <dt className="text-muted-foreground">{t("ownerEmail")}</dt>
          <dd className="truncate">
            {detail.owner.email ?? t("notAvailable")}
          </dd>
        </dl>
      </DetailSection>

      <Separator />

      <DetailSection title={t("membership")}>
        {detail.membership ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge
              status={detail.membership.status}
              variantMap={membershipStatusVariants}
              label={membershipT(detail.membership.status)}
            />
            {detail.membership.renewsAt ? (
              <span className="text-muted-foreground" suppressHydrationWarning>
                {t("renewsAt", {
                  date: formatter.dateTime(detail.membership.renewsAt, {
                    dateStyle: "medium",
                  }),
                })}
              </span>
            ) : null}
            {!detail.membership.hasStripeSubscription ? (
              <Badge variant="outline" className="font-normal">
                {t("noStripeSubscription")}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noMembership")}</p>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title={t("spending")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("monthSpend")}</dt>
          <dd className="font-mono font-semibold tabular-nums">
            {currency(detail.monthSpendCents)}
          </dd>
          <dt className="text-muted-foreground">{t("ordersCount")}</dt>
          <dd className="tabular-nums">{detail.ordersCount}</dd>
        </dl>
      </DetailSection>

      <Separator />

      <DetailSection
        title={t("requests", { count: detail.tierChangeRequests.length })}
      >
        {requestsSlot}
      </DetailSection>

      <Separator />

      <DetailSection title={t("locations", { count: detail.activeLocations })}>
        {detail.locations.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noLocations")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.locations.map((location) => (
              <li
                key={location.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <MapPinIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{location.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {location.addressLine} · {location.city}
                    {location.contactName ? ` · ${location.contactName}` : ""}
                  </span>
                </div>
                {!location.isActive ? (
                  <Badge variant="outline" className="font-normal">
                    {t("inactiveLocation")}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title={t("recentOrders", { count: detail.ordersCount })}>
        {detail.orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noOrders")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{order.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    #{order.folio} · {orderStatusT(order.status)}
                    {order.corporateLocation
                      ? ` · ${order.corporateLocation.name}`
                      : ""}
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
    </div>
  );
}

export type CorporateDetailSheetProps = {
  accountId: string | null;
  onClose: () => void;
  requestsSlot: (detail: CorporateAccountDetail) => ReactNode;
  actionsSlot: (detail: CorporateAccountDetail) => ReactNode;
};

/**
 * Full account file: negotiated terms, owner, membership, spending, pending
 * tier requests, locations and recent orders. Lifecycle actions render in the
 * footer through `actionsSlot`, so the sheet never owns a dialog.
 */
export function CorporateDetailSheet({
  accountId,
  onClose,
  requestsSlot,
  actionsSlot,
}: CorporateDetailSheetProps) {
  const t = useTranslations("admin.corporate.detail");
  const query = api.admin.corporate.getById.useQuery(
    { accountId: accountId ?? "" },
    { enabled: accountId !== null },
  );
  const state = unwrapEnvelope(query);

  return (
    <Sheet
      open={accountId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3 pr-8">
            {state.status === "success" ? (
              <UserAvatar
                seed={state.data.id}
                name={state.data.name}
                size={48}
                state={
                  isDormantCorporate(state.data.status) ? "sleeping" : "default"
                }
                interactive
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1.5">
              <SheetTitle>
                {state.status === "success" ? state.data.name : t("title")}
              </SheetTitle>
              <SheetDescription>{t("subtitle")}</SheetDescription>
            </div>
          </div>
          {state.status === "success" ? (
            <CopyIdButton value={state.data.id} className="-ml-2 self-start" />
          ) : null}
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
            <DetailBody
              detail={state.data}
              requestsSlot={requestsSlot(state.data)}
            />
          ) : null}
        </div>

        {state.status === "success" ? (
          <SheetFooter className="border-t">
            {actionsSlot(state.data)}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
