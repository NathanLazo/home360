"use client";

import { useEffect, useRef } from "react";
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { usePaymentMutations } from "./use-payment-mutations";
import { usePathname, useRouter } from "~/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function ConnectOnboardingBanner() {
  const t = useTranslations("dashboard.payments.onboarding");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusQuery = api.payment.getConnectStatus.useQuery();
  const {
    startOnboarding,
    startingOnboarding,
    refreshConnectStatus,
    refreshingConnectStatus,
  } = usePaymentMutations();

  const onboardingParam = searchParams.get("onboarding");
  // Guards the one-shot contract: returning from Stripe must reconcile exactly
  // once, even though effects re-run on re-render and in strict mode.
  const reconciledRef = useRef(false);

  useEffect(() => {
    if (onboardingParam !== "complete" || reconciledRef.current) {
      return;
    }

    reconciledRef.current = true;

    void (async () => {
      const status = await refreshConnectStatus();

      // Success is the real capability, not the mere return from Stripe.
      if (status?.payoutsEnabled === true) {
        toast.success(t("completed"));
      }

      // Drop the param so a reload cannot trigger a second reconciliation.
      router.replace(pathname);
    })();
  }, [onboardingParam, pathname, refreshConnectStatus, router, t]);

  const status =
    statusQuery.data?.error === null ? statusQuery.data.result : null;

  if (!status) {
    return null;
  }

  const isReady = status.hasAccount && status.payoutsEnabled;

  if (isReady) {
    return null;
  }

  const busy = startingOnboarding || refreshingConnectStatus;

  return (
    <Alert>
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{status.hasAccount ? t("pending") : t("missing")}</span>
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={() => void startOnboarding()}
        >
          {busy ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {status.hasAccount ? t("resume") : t("start")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
