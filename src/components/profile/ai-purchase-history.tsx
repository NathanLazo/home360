"use client";

import { useFormatter, useTranslations } from "next-intl";

import { SectionError } from "~/components/section-error";
import { StatusBadge } from "~/components/status-badge";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const STATUS_VARIANTS = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "destructive",
} as const;

/** Token packs bought through Stripe: date, pack, amount and status. */
export function AiPurchaseHistory() {
  const t = useTranslations("profile.billing");
  const format = useFormatter();
  const query = api.aiBilling.listPurchases.useQuery();
  const state = unwrapEnvelope(query);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-copy font-semibold">{t("purchases.title")}</h3>

      {state.status === "pending" ? (
        <Skeleton className="h-12 w-full" aria-hidden="true" />
      ) : null}

      {state.status === "error" ? (
        <SectionError
          title={t("purchasesErrorTitle")}
          code={state.code}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {state.status === "success" ? (
        state.data.length === 0 ? (
          <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-xl px-4 py-3">
            {t("purchases.empty")}
          </p>
        ) : (
          <ul className="divide-hairline divide-y">
            {state.data.map((purchase) => (
              <li
                key={purchase.id}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-copy-sm font-medium">
                    {t("purchases.row", { code: purchase.packCode })}
                  </p>
                  <p className="text-muted-foreground text-label font-mono">
                    {format.dateTime(purchase.paidAt ?? purchase.createdAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge
                    status={purchase.status}
                    variantMap={STATUS_VARIANTS}
                    label={t(`purchases.status.${purchase.status}`)}
                  />
                  <p className="text-copy-sm font-mono tabular-nums">
                    {format.number(purchase.amountUsdCents / 100, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
