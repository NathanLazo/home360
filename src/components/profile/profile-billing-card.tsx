"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, CoinsIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AiBalanceSummary } from "./ai-balance-summary";
import { AiPurchaseHistory } from "./ai-purchase-history";
import { AiUsageLedger } from "./ai-usage-ledger";
import { BuyCreditsDialog } from "./buy-credits-dialog";
import { ProfileNotice } from "./profile-notice";
import { ProfileSectionCard } from "./profile-section-card";
import type { AiBillingSummary } from "./profile.types";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Link } from "~/i18n/navigation";
import type { AgentArea } from "~/lib/agent/agent-area";
import type { EnvelopeState } from "~/lib/trpc-envelope";

const CREDITS_PARAM = "credits";

const INVOICES_HREF: Partial<Record<AgentArea, string>> = {
  business: "/dashboard/subscription",
  corporate: "/corporate/membership",
};

/**
 * The wallet card. Its own query so a Stripe hiccup never takes the profile
 * down. Business and corporate owners see balance + buy + ledger + purchases;
 * admins see "internal usage, no charge" with the ledger kept for audit.
 */
export function ProfileBillingCard({
  area,
  state,
  available,
  disabled,
  onRetry,
  onPurchaseSettled,
}: {
  area: AgentArea;
  state: EnvelopeState<AiBillingSummary>;
  available: boolean;
  disabled: boolean;
  onRetry: () => void;
  /** Called once when Stripe returns to `?credits=success`. */
  onPurchaseSettled: () => void;
}) {
  const t = useTranslations("profile.billing");
  const notices = useTranslations("profile");
  const searchParams = useSearchParams();
  const [buyOpen, setBuyOpen] = useState(false);
  const settledRef = useRef(false);
  const invoicesHref = INVOICES_HREF[area];

  // Stripe Checkout returns here: one toast, refresh the balance, clean the URL.
  useEffect(() => {
    const outcome = searchParams.get(CREDITS_PARAM);
    if (!outcome || settledRef.current) return;
    settledRef.current = true;

    if (outcome === "success") {
      toast.success(t("checkout.success"));
      onPurchaseSettled();
    } else if (outcome === "cancelled") {
      toast.info(t("checkout.cancelled"));
    }

    const url = new URL(window.location.href);
    url.searchParams.delete(CREDITS_PARAM);
    window.history.replaceState(window.history.state, "", url);
  }, [searchParams, t, onPurchaseSettled]);

  return (
    <ProfileSectionCard
      id="billing"
      title={t("title")}
      description={t("description")}
      icon={CoinsIcon}
    >
      {!available ? (
        <ProfileNotice>{notices("notConfigured")}</ProfileNotice>
      ) : null}

      {state.status === "pending" ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <SectionError
          title={t("queryErrorTitle")}
          code={state.code}
          onRetry={onRetry}
        />
      ) : null}

      {state.status === "success" ? (
        state.data.mode === "internal" ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-copy font-semibold">{t("internalNoCharge")}</p>
              <p className="text-muted-foreground text-copy-sm">
                {t("internalDescription")}
              </p>
            </div>
            <Separator />
            <AiUsageLedger />
          </>
        ) : (
          <>
            <AiBalanceSummary
              balanceUsdMicros={state.data.balanceUsdMicros}
              action={
                available && state.data.packs.length > 0 ? (
                  <Button
                    type="button"
                    beam
                    beamActive={!buyOpen}
                    disabled={disabled}
                    onClick={() => setBuyOpen(true)}
                    className="w-full sm:w-auto"
                    metalClassName="w-full sm:w-auto"
                  >
                    <CoinsIcon aria-hidden="true" />
                    {t("buy")}
                  </Button>
                ) : null
              }
            />
            <Separator />
            <AiUsageLedger />
            <Separator />
            <AiPurchaseHistory />
            {invoicesHref ? (
              <Link
                href={invoicesHref}
                className="text-link-deep text-copy-sm focus-visible:ring-ring inline-flex w-fit items-center gap-1 rounded-xs underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {t("invoicesLink")}
                <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
              </Link>
            ) : null}
            <BuyCreditsDialog
              open={buyOpen}
              onOpenChange={setBuyOpen}
              packs={state.data.packs}
            />
          </>
        )
      ) : null}
    </ProfileSectionCard>
  );
}
