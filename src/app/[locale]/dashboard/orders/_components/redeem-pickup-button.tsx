"use client";

import { useState } from "react";
import { ScanLineIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderRedeemPickupDialog } from "./order-redeem-pickup-dialog";
import { useOrderMutations } from "./use-order-mutations";
import {
  useReadOnlyNotice,
  useSubscriptionAccess,
} from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";

/**
 * Counter shortcut of the order book: the customer shows the pickup QR and
 * the business redeems it without looking the order up first (the code
 * itself identifies the order, D10-2).
 */
export function RedeemPickupButton() {
  const t = useTranslations("dashboard.orders.actions");
  const readOnlyNotice = useReadOnlyNotice();
  const { isReadOnly } = useSubscriptionAccess();
  const mutations = useOrderMutations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 self-start"
        disabled={isReadOnly}
        title={isReadOnly ? readOnlyNotice : undefined}
        onClick={() => setOpen(true)}
      >
        <ScanLineIcon aria-hidden="true" />
        {t("redeemPickup")}
      </Button>
      <OrderRedeemPickupDialog
        open={open}
        loading={mutations.redeeming}
        onOpenChange={setOpen}
        onRedeem={mutations.redeemPickup}
      />
    </>
  );
}
