"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { CorporateMembershipSummary } from "../../_components/corporate.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const ACCOUNT_STATUS_VARIANTS: Record<
  CorporateMembershipSummary["status"],
  StatusBadgeVariant
> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "destructive",
  CANCELLED: "muted",
};

type SubscriptionStatusKey = NonNullable<
  CorporateMembershipSummary["membership"]
>["status"];

const SUBSCRIPTION_STATUS_VARIANTS: Record<
  SubscriptionStatusKey,
  StatusBadgeVariant
> = {
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "muted",
};

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-copy-sm flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function MembershipSummaryCard({
  membership,
}: {
  membership: CorporateMembershipSummary;
}) {
  const t = useTranslations("corporate.membership");
  const tierT = useTranslations("corporate.tier");
  const formatter = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("summary.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <SummaryRow label={t("summary.tier")}>
            {tierT(membership.tier)}
          </SummaryRow>
          <SummaryRow label={t("summary.monthlyFee")}>
            <span className="font-mono tabular-nums">
              {formatter.number(membership.monthlyFeeCents / 100, {
                style: "currency",
                currency: "MXN",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </SummaryRow>
          <SummaryRow label={t("summary.commission")}>
            <span className="font-mono tabular-nums">
              {t("summary.commissionValue", {
                pct: membership.commissionPct,
              })}
            </span>
          </SummaryRow>
          <SummaryRow label={t("summary.renewsAt")}>
            {membership.membership?.renewsAt
              ? formatter.dateTime(membership.membership.renewsAt, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : t("summary.renewsAtUnknown")}
          </SummaryRow>
          <SummaryRow label={t("summary.status")}>
            <StatusBadge
              status={membership.status}
              variantMap={ACCOUNT_STATUS_VARIANTS}
              label={t(`accountStatus.${membership.status}`)}
            />
          </SummaryRow>
          <SummaryRow label={t("summary.membershipStatus")}>
            {membership.membership ? (
              <StatusBadge
                status={membership.membership.status}
                variantMap={SUBSCRIPTION_STATUS_VARIANTS}
                label={t(`subscriptionStatus.${membership.membership.status}`)}
              />
            ) : (
              <span className="text-muted-foreground">
                {t("subscriptionStatus.none")}
              </span>
            )}
          </SummaryRow>
        </dl>
      </CardContent>
    </Card>
  );
}
