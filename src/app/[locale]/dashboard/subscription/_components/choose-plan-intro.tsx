"use client";

import { TicketPercentIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "~/components/ui/card";

/**
 * Explains the only step left for an approved business without a plan: pick
 * one below, pay on Stripe, and redeem a discount code there if it has one.
 */
export function ChoosePlanIntro() {
  const t = useTranslations("dashboard.subscription.choosePlan");

  return (
    <Card className="bg-tint-wash">
      <CardContent className="flex flex-col gap-2">
        <h2 className="text-display-sm">{t("title")}</h2>
        <p className="text-muted-foreground text-copy-sm">{t("description")}</p>
        <p className="text-copy-sm flex items-center gap-2">
          <TicketPercentIcon
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          {t("promoHint")}
        </p>
      </CardContent>
    </Card>
  );
}
