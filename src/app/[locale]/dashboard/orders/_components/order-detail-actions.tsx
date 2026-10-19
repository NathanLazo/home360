"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import {
  CircleXIcon,
  InfoIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PackageCheckIcon,
  ScanLineIcon,
  StoreIcon,
  TruckIcon,
  UserRoundCogIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderAssignWorkerDialog } from "./order-assign-worker-dialog";
import { OrderCancelDialog } from "./order-cancel-dialog";
import {
  cancelRefunds,
  getOrderNextStep,
  getOrderPrimaryAction,
} from "./order-lifecycle";
import { OrderMarkDeliveredDialog } from "./order-mark-delivered-dialog";
import { OrderRedeemPickupDialog } from "./order-redeem-pickup-dialog";
import type { OrderDetail, WorkerOption } from "./order.types";
import { useOrderMutations } from "./use-order-mutations";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";

type OpenDialog =
  "cancel" | "assign" | "delivered" | "readyForPickup" | "redeem" | null;

type ActionKey =
  | "acceptProduct"
  | "markOutForDelivery"
  | "markDelivered"
  | "markReadyForPickup"
  | "redeemPickup"
  | "assignWorker";

type ActionDescriptor = {
  key: ActionKey;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  pending: boolean;
  onClick: () => void;
};

/**
 * Next-step hint plus the business actions the order allows right now. The
 * buttons come from the server's `order.actions` (shared with mobile); the
 * one that moves the order forward is the sheet's single primary CTA and the
 * rest stay outline/ghost. Mutations are blocked (with the reason as
 * tooltip) on read-only accounts; messaging the customer is always on.
 */
export function OrderDetailActions({
  order,
  workers,
  conversationOpen,
  onToggleConversation,
}: {
  order: OrderDetail;
  workers: WorkerOption[];
  conversationOpen: boolean;
  onToggleConversation: () => void;
}) {
  const t = useTranslations("dashboard.orders.actions");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyTitle = isReadOnly ? readOnlyT("actionDisabled") : undefined;
  const mutations = useOrderMutations();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const { actions } = order;
  const nextStep = getOrderNextStep(order);
  const primary = getOrderPrimaryAction(order);
  const busy =
    mutations.accepting ||
    mutations.cancelling ||
    mutations.assigning ||
    mutations.markingOutForDelivery ||
    mutations.markingDelivered ||
    mutations.markingReadyForPickup ||
    mutations.redeeming;
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const descriptors: ActionDescriptor[] = [];

  if (actions.acceptProduct) {
    descriptors.push({
      key: "acceptProduct",
      label: t("accept"),
      icon: PackageCheckIcon,
      pending: mutations.accepting,
      onClick: () => void mutations.accept(order.id),
    });
  }
  if (actions.markDelivered) {
    descriptors.push({
      key: "markDelivered",
      label: t("markDelivered"),
      icon: PackageCheckIcon,
      pending: mutations.markingDelivered,
      onClick: () => setDialog("delivered"),
    });
  }
  if (actions.markOutForDelivery) {
    descriptors.push({
      key: "markOutForDelivery",
      label: t("markOutForDelivery"),
      icon: TruckIcon,
      pending: mutations.markingOutForDelivery,
      onClick: () => void mutations.markOutForDelivery(order.id),
    });
  }
  if (actions.markReadyForPickup) {
    descriptors.push({
      key: "markReadyForPickup",
      label: t("markReadyForPickup"),
      icon: StoreIcon,
      pending: mutations.markingReadyForPickup,
      onClick: () => setDialog("readyForPickup"),
    });
  }
  if (actions.redeemPickup) {
    descriptors.push({
      key: "redeemPickup",
      label: t("redeemPickup"),
      icon: ScanLineIcon,
      pending: mutations.redeeming,
      onClick: () => setDialog("redeem"),
    });
  }
  if (actions.assignWorker) {
    descriptors.push({
      key: "assignWorker",
      label: t(order.worker ? "reassignWorker" : "assignWorker"),
      icon: UserRoundCogIcon,
      pending: mutations.assigning,
      onClick: () => setDialog("assign"),
    });
  }

  // The primary CTA leads the row; the rest keep their lifecycle order.
  descriptors.sort(
    (left, right) =>
      Number(right.key === primary) - Number(left.key === primary),
  );

  return (
    <section aria-labelledby="order-actions-heading" className="space-y-4">
      <h3 id="order-actions-heading" className="sr-only">
        {t("title")}
      </h3>
      <div className="bg-canvas-soft flex gap-3 rounded-xl border p-4">
        <InfoIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <div className="space-y-1">
          <p className="text-copy-sm font-medium">
            {t(`nextStep.${nextStep}.title`)}
          </p>
          <p className="text-muted-foreground text-copy-sm text-pretty">
            {t(`nextStep.${nextStep}.description`)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {descriptors.map((action) => {
          const isPrimary = action.key === primary;
          const Icon = action.icon;

          return (
            <Button
              key={action.key}
              type="button"
              variant={isPrimary ? "default" : "outline"}
              metal={isPrimary ? "live" : "static"}
              // A dialog taking over hands it the screen's live ring.
              metalActive={dialog === null}
              disabled={busy || isReadOnly}
              title={readOnlyTitle}
              aria-busy={action.pending || undefined}
              onClick={action.onClick}
            >
              {action.pending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Icon aria-hidden="true" />
              )}
              {action.label}
            </Button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          aria-expanded={conversationOpen}
          aria-controls="order-conversation"
          onClick={onToggleConversation}
        >
          <MessageSquareIcon aria-hidden="true" />
          {t(conversationOpen ? "hideConversation" : "messageCustomer")}
        </Button>
        {actions.cancel ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy || isReadOnly}
            title={readOnlyTitle}
            onClick={() => setDialog("cancel")}
          >
            <CircleXIcon aria-hidden="true" />
            {t("cancel")}
          </Button>
        ) : null}
      </div>

      <OrderCancelDialog
        open={dialog === "cancel"}
        folio={order.folio}
        willRefund={cancelRefunds(order)}
        loading={mutations.cancelling}
        onOpenChange={closeDialog}
        onConfirm={(reason) =>
          void mutations.cancel(order.id, reason).then((done) => {
            if (done) setDialog(null);
          })
        }
      />
      <OrderAssignWorkerDialog
        open={dialog === "assign"}
        folio={order.folio}
        currentWorkerId={order.worker?.id ?? null}
        workers={workers}
        loading={mutations.assigning}
        onOpenChange={closeDialog}
        onConfirm={(workerId) =>
          void mutations.assignWorker(order.id, workerId).then((done) => {
            if (done) setDialog(null);
          })
        }
      />
      <OrderMarkDeliveredDialog
        open={dialog === "delivered"}
        folio={order.folio}
        loading={mutations.markingDelivered}
        onOpenChange={closeDialog}
        onConfirm={(input) => mutations.markDelivered(order.id, input)}
      />
      <ConfirmDialog
        open={dialog === "readyForPickup"}
        onOpenChange={closeDialog}
        title={t("readyForPickupDialog.title", { folio: order.folio })}
        description={t("readyForPickupDialog.description", {
          branch: order.branch?.name ?? t("readyForPickupDialog.yourBranch"),
        })}
        confirmLabel={t("readyForPickupDialog.confirm")}
        cancelLabel={t("readyForPickupDialog.cancel")}
        loading={mutations.markingReadyForPickup}
        onConfirm={() =>
          void mutations.markReadyForPickup(order.id).then((done) => {
            if (done) setDialog(null);
          })
        }
      />
      <OrderRedeemPickupDialog
        open={dialog === "redeem"}
        loading={mutations.redeeming}
        onOpenChange={closeDialog}
        onRedeem={mutations.redeemPickup}
      />
    </section>
  );
}
