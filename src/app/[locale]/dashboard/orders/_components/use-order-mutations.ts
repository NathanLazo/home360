"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
    await Promise.all([
      utils.order.list.invalidate(),
      utils.order.getById.invalidate(),
    ]);
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
    accepting: acceptMutation.isPending,
    cancelling: cancelMutation.isPending,
    assigning: assignMutation.isPending,
  };
}
