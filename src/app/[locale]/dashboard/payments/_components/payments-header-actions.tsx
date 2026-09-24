"use client";

import { useEffect, useState } from "react";
import { BanknoteArrowDownIcon, LinkIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { CreatePaymentLinkDialog } from "./create-payment-link-dialog";
import { WithdrawDialog } from "./withdraw-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import { usePathname, useRouter } from "~/i18n/navigation";
import { api } from "~/trpc/react";

export function PaymentsHeaderActions({
  availableCents,
}: {
  availableCents: number | null;
}) {
  const t = useTranslations("dashboard.payments.actions");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const formatter = useFormatter();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Deep link from the home's key action (and the links tab empty state):
  // open the create dialog once, then drop only that param so a refresh or
  // back navigation doesn't reopen it while `?tab=` / `?branch=` survive.
  useEffect(() => {
    if (searchParams.get("create") !== "link") return;
    if (!isReadOnly) setLinkDialogOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [searchParams, isReadOnly, router, pathname]);

  const connectQuery = api.payment.getConnectStatus.useQuery();
  const connectStatus =
    connectQuery.data?.error === null ? connectQuery.data.result : null;

  const payoutsReady = connectStatus?.payoutsEnabled === true;
  const hasBalance = availableCents !== null && availableCents > 0;
  const canWithdraw = payoutsReady && hasBalance;

  // Formatting only; the figure itself is the server's XC-03 net balance.
  const withdrawLabel =
    availableCents === null
      ? t("withdraw")
      : t("withdrawAmount", {
          amount: formatter.number(availableCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setLinkDialogOpen(true)}
        disabled={isReadOnly}
        title={isReadOnly ? readOnlyT("actionDisabled") : undefined}
      >
        <LinkIcon aria-hidden="true" />
        {t("createLink")}
      </Button>

      <Button
        beam
        // The open dialog's confirm takes over the beam.
        beamActive={!withdrawDialogOpen}
        type="button"
        className="min-h-11 sm:min-h-10"
        disabled={!canWithdraw || isReadOnly}
        title={
          isReadOnly
            ? readOnlyT("actionDisabled")
            : payoutsReady
              ? undefined
              : t("withdrawNeedsConnect")
        }
        onClick={() => setWithdrawDialogOpen(true)}
      >
        <BanknoteArrowDownIcon aria-hidden="true" />
        {withdrawLabel}
      </Button>

      <CreatePaymentLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
      />

      {availableCents !== null ? (
        <WithdrawDialog
          open={withdrawDialogOpen}
          availableCents={availableCents}
          onOpenChange={setWithdrawDialogOpen}
        />
      ) : null}
    </>
  );
}
