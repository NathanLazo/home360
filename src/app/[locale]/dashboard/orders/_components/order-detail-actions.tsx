"use client";

import { useState } from "react";
import {
  CircleXIcon,
  InfoIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PackageCheckIcon,
  UserRoundCogIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderAssignWorkerDialog } from "./order-assign-worker-dialog";
import { OrderCancelDialog } from "./order-cancel-dialog";
import { getOrderActions, getOrderNextStep } from "./order-lifecycle";
import type { OrderDetail, WorkerOption } from "./order.types";
import { useOrderMutations } from "./use-order-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";

/**
 * Next-step hint plus the business actions the order allows right now.
 * Mutations are blocked (with the reason as tooltip) on read-only accounts;
 * messaging the customer is always available.
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const actions = getOrderActions(order);
  const nextStep = getOrderNextStep(order);
  const busy =
    mutations.accepting || mutations.cancelling || mutations.assigning;

  return (
    <section aria-labelledby="order-actions-heading" className="space-y-4">
      <h3 id="order-actions-heading" className="sr-only">
        {t("title")}
      </h3>
      <div className="bg-canvas-soft flex gap-3 rounded-md border p-4">
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
        {actions.accept ? (
          <Button
            type="button"
            metal="live"
            disabled={busy || isReadOnly}
            title={readOnlyTitle}
            onClick={() => void mutations.accept(order.id)}
          >
            {mutations.accepting ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <PackageCheckIcon aria-hidden="true" />
            )}
            {t("accept")}
          </Button>
        ) : null}
        {actions.assignWorker ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || isReadOnly}
            title={readOnlyTitle}
            onClick={() => setAssignOpen(true)}
          >
            <UserRoundCogIcon aria-hidden="true" />
            {t(order.worker ? "reassignWorker" : "assignWorker")}
          </Button>
        ) : null}
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
            onClick={() => setCancelOpen(true)}
          >
            <CircleXIcon aria-hidden="true" />
            {t("cancel")}
          </Button>
        ) : null}
      </div>

      <OrderCancelDialog
        open={cancelOpen}
        folio={order.folio}
        willRefund={actions.cancelRefunds}
        loading={mutations.cancelling}
        onOpenChange={setCancelOpen}
        onConfirm={(reason) =>
          void mutations.cancel(order.id, reason).then((done) => {
            if (done) setCancelOpen(false);
          })
        }
      />
      <OrderAssignWorkerDialog
        open={assignOpen}
        folio={order.folio}
        currentWorkerId={order.worker?.id ?? null}
        workers={workers}
        loading={mutations.assigning}
        onOpenChange={setAssignOpen}
        onConfirm={(workerId) =>
          void mutations.assignWorker(order.id, workerId).then((done) => {
            if (done) setAssignOpen(false);
          })
        }
      />
    </section>
  );
}
