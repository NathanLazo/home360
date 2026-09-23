"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CorporateRequestCreateInput } from "~/server/api/schemas/corporate";
import type { DisputeReason } from "~/schemas/disputes/dispute-reasons";
import { api } from "~/trpc/react";

type Envelope = { error: string | null };

/**
 * Every mutation of the corporate consumer flow with envelope-aware feedback:
 * failures resolve by stable code into translated copy (never the raw
 * `message`) and successes refresh every view that shows the same data.
 */
export function useCorporateOrderActions() {
  const t = useTranslations("corporate.orders.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();

  const createRequestMutation = api.corporate.createRequest.useMutation();
  const acceptQuoteMutation = api.corporate.acceptQuote.useMutation();
  const checkoutMutation = api.corporate.createCheckoutSession.useMutation();
  const confirmMutation = api.corporate.confirmDelivery.useMutation();
  const disputeMutation = api.corporate.openDispute.useMutation();
  const reworkMutation = api.corporate.requestRework.useMutation();
  const cancelMutation = api.corporate.cancelOrder.useMutation();

  async function refresh() {
    await Promise.all([
      utils.corporate.listRequests.invalidate(),
      utils.corporate.listOrders.invalidate(),
      utils.corporate.getOrder.invalidate(),
      utils.corporate.getOverview.invalidate(),
    ]);
  }

  function failed(response: Envelope): boolean {
    if (response.error === null) {
      return false;
    }

    toast.error(errors(response.error));
    return true;
  }

  async function run<TResponse extends Envelope>(
    action: () => Promise<TResponse>,
    messages: { success?: string; error: string },
  ): Promise<TResponse | null> {
    try {
      const response = await action();

      if (failed(response)) {
        return null;
      }

      if (messages.success) {
        toast.success(messages.success);
      }

      await refresh();
      return response;
    } catch {
      toast.error(messages.error);
      return null;
    }
  }

  async function createRequest(input: CorporateRequestCreateInput) {
    const response = await run(() => createRequestMutation.mutateAsync(input), {
      success: t("requestCreated"),
      error: t("requestError"),
    });

    return response !== null;
  }

  async function acceptQuote(quoteId: string) {
    const response = await run(
      () => acceptQuoteMutation.mutateAsync({ quoteId }),
      { success: t("quoteAccepted"), error: t("quoteError") },
    );

    return response?.result && "orderId" in response.result
      ? response.result.orderId
      : null;
  }

  /** Sends the buyer to the hosted Stripe Checkout (escrow). */
  async function pay(orderId: string) {
    const response = await run(
      () => checkoutMutation.mutateAsync({ orderId }),
      { error: t("payError") },
    );
    const url =
      response?.result && "url" in response.result ? response.result.url : null;

    if (url) {
      window.location.assign(url);
    }
  }

  async function confirmDelivery(orderId: string) {
    const response = await run(() => confirmMutation.mutateAsync({ orderId }), {
      success: t("confirmed"),
      error: t("confirmError"),
    });

    return response !== null;
  }

  async function openDispute(input: {
    orderId: string;
    reason: DisputeReason;
    description: string;
  }) {
    const response = await run(() => disputeMutation.mutateAsync(input), {
      success: t("disputeOpened"),
      error: t("disputeError"),
    });

    return response !== null;
  }

  /** Asks the provider to fix the work; pauses the escrow auto-release. */
  async function requestRework(input: { orderId: string; note: string }) {
    const response = await run(() => reworkMutation.mutateAsync(input), {
      success: t("reworkRequested"),
      error: t("reworkError"),
    });

    return response !== null;
  }

  async function cancelOrder(orderId: string) {
    const response = await run(() => cancelMutation.mutateAsync({ orderId }), {
      success: t("cancelled"),
      error: t("cancelError"),
    });

    return response !== null;
  }

  return {
    createRequest,
    acceptQuote,
    pay,
    confirmDelivery,
    openDispute,
    requestRework,
    cancelOrder,
    creatingRequest: createRequestMutation.isPending,
    acceptingQuote: acceptQuoteMutation.isPending,
    paying: checkoutMutation.isPending,
    confirming: confirmMutation.isPending,
    disputing: disputeMutation.isPending,
    reworking: reworkMutation.isPending,
    cancelling: cancelMutation.isPending,
  };
}
