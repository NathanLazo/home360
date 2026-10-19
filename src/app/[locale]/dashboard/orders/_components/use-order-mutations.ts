"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { RedeemPickupOutcome } from "./order-redeem-pickup-dialog";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

type OperationResponse = {
  result: object | null;
  error: string | null;
};

/** Order lifecycle mutations of the detail sheet with shared feedback. */
export function useOrderMutations() {
  const t = useTranslations("dashboard.orders.actions.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const acceptMutation = api.order.acceptProduct.useMutation();
  const cancelMutation = api.order.cancel.useMutation();
  const assignMutation = api.order.assignWorker.useMutation();
  const outForDeliveryMutation = api.order.markOutForDelivery.useMutation();
  const deliveredMutation = api.order.markDelivered.useMutation();
  const readyForPickupMutation = api.order.markReadyForPickup.useMutation();
  const redeemMutation = api.order.redeemPickup.useMutation();

  async function refresh() {
    await Promise.all([
      utils.order.list.invalidate(),
      utils.order.getById.invalidate(),
    ]);
  }

  async function finish(
    response: OperationResponse,
    successMessage: string,
  ): Promise<boolean> {
    if (response.error !== null || response.result === null) {
      toast.error(
        response.error ? errors(response.error) : t("transportError"),
      );
      await utils.order.getById.invalidate();
      return false;
    }

    toast.success(successMessage);
    await refresh();
    return true;
  }

  async function run(
    operation: () => Promise<OperationResponse>,
    successMessage: string,
  ): Promise<boolean> {
    try {
      return await finish(await operation(), successMessage);
    } catch {
      toast.error(t("transportError"));
      return false;
    }
  }

  /**
   * Redemption errors render inline in the dialog (the code field), so only
   * success raises a toast. `released: false` means the transfer is retried
   * by the release cron: the order completes a few minutes later.
   */
  async function redeemPickup(code: string): Promise<RedeemPickupOutcome> {
    try {
      const response = await redeemMutation.mutateAsync({ code });

      if (response.error !== null || response.result === null) {
        return { ok: false, code: response.error ?? "UNKNOWN_ERROR" };
      }

      const { folio, released } = response.result;
      toast.success(
        t(released ? "pickupRedeemed" : "pickupRedeemedPending", { folio }),
      );
      await refresh();
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, code: toErrorCode(error) };
    }
  }

  return {
    accept: (orderId: string) =>
      run(() => acceptMutation.mutateAsync({ id: orderId }), t("accepted")),
    cancel: (orderId: string, reason: string) =>
      run(
        () => cancelMutation.mutateAsync({ id: orderId, reason }),
        t("cancelled"),
      ),
    assignWorker: (orderId: string, workerId: string) =>
      run(
        () => assignMutation.mutateAsync({ orderId, workerId }),
        t("workerAssigned"),
      ),
    markOutForDelivery: (orderId: string) =>
      run(
        () => outForDeliveryMutation.mutateAsync({ id: orderId }),
        t("outForDelivery"),
      ),
    markDelivered: (
      orderId: string,
      input: { evidencePathnames: string[]; note?: string },
    ) =>
      run(
        () => deliveredMutation.mutateAsync({ id: orderId, ...input }),
        t("delivered"),
      ),
    markReadyForPickup: (orderId: string) =>
      run(
        () => readyForPickupMutation.mutateAsync({ id: orderId }),
        t("readyForPickup"),
      ),
    redeemPickup,
    accepting: acceptMutation.isPending,
    cancelling: cancelMutation.isPending,
    assigning: assignMutation.isPending,
    markingOutForDelivery: outForDeliveryMutation.isPending,
    markingDelivered: deliveredMutation.isPending,
    markingReadyForPickup: readyForPickupMutation.isPending,
    redeeming: redeemMutation.isPending,
  };
}
