"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { usePathname, useRouter } from "~/i18n/navigation";
import { api } from "~/trpc/react";

/** Short follow-up reads: the webhook usually binds the plan within seconds. */
const FOLLOW_UP_DELAYS_MS = [2_000, 6_000] as const;

/**
 * Reacts to the `?checkout=` flag Stripe Checkout returns with: one toast,
 * fresh subscription data and a clean URL, so a reload never repeats it.
 */
export function useCheckoutReturn() {
  const t = useTranslations("dashboard.subscription.checkout");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const outcome = searchParams.get("checkout");

  useEffect(() => {
    if (outcome !== "success" && outcome !== "canceled") {
      return;
    }

    router.replace(pathname, { scroll: false });

    if (outcome === "canceled") {
      toast(t("canceled"));
      return;
    }

    toast.success(t("success"));

    const refresh = () => {
      void utils.subscription.getCurrent.invalidate();
      void utils.subscription.listPlans.invalidate();
      void utils.subscription.listInvoices.invalidate();
      router.refresh();
    };

    refresh();
    const timers = FOLLOW_UP_DELAYS_MS.map((delay) =>
      window.setTimeout(refresh, delay),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [outcome, pathname, router, t, utils]);
}
