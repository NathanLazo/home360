"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  ConnectStatus,
  CreatePaymentLinkInput,
  CreatedPaymentLink,
  RequestWithdrawalInput,
} from "./payment.types";
import { api } from "~/trpc/react";

/**
 * TanStack's `onSuccess` only means the transport succeeded. Domain outcome
 * lives in the `TrpcResponse` envelope, so every mutation is unwrapped here:
 * `error === null && result !== null` is the only success, a stable `error`
 * code is translated from `errors.json`, and a thrown request is the sole
 * responsibility of the `catch`.
 */
function unwrap<TResult>(response: {
  result: TResult | null;
  error: string | null;
}): TResult | null {
  return response.error === null ? response.result : null;
}

export function usePaymentMutations() {
  const t = useTranslations("dashboard.payments");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();

  function reportFailure(code: string | null) {
    toast.error(code === null ? t("unexpectedError") : errorsT(code));
  }

  async function invalidateMoney() {
    await Promise.all([
      utils.payment.getBalances.invalidate(),
      utils.payment.listTransactions.invalidate(),
    ]);
  }

  const startOnboardingMutation = api.payment.startOnboarding.useMutation();
  const refreshConnectStatusMutation =
    api.payment.refreshConnectStatus.useMutation();
  const createPaymentLinkMutation = api.payment.createPaymentLink.useMutation();
  const requestWithdrawalMutation = api.payment.requestWithdrawal.useMutation();

  async function startOnboarding(): Promise<void> {
    try {
      const response = await startOnboardingMutation.mutateAsync();
      const created = unwrap(response);

      if (!created) {
        reportFailure(response.error);
        return;
      }

      // Stripe-hosted onboarding lives outside the app, so this is a full
      // document navigation rather than a client-side route change.
      window.location.href = created.url;
    } catch {
      reportFailure(null);
    }
  }

  async function refreshConnectStatus(): Promise<ConnectStatus | null> {
    try {
      const response = await refreshConnectStatusMutation.mutateAsync();
      const status = unwrap(response);

      if (!status) {
        reportFailure(response.error);
        return null;
      }

      await utils.payment.getConnectStatus.invalidate();

      return status;
    } catch {
      reportFailure(null);
      return null;
    }
  }

  async function createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatedPaymentLink | null> {
    try {
      const response = await createPaymentLinkMutation.mutateAsync(input);
      const created = unwrap(response);

      if (!created) {
        reportFailure(response.error);
        return null;
      }

      await invalidateMoney();

      return created;
    } catch {
      reportFailure(null);
      return null;
    }
  }

  async function requestWithdrawal(
    input: RequestWithdrawalInput,
  ): Promise<boolean> {
    try {
      const response = await requestWithdrawalMutation.mutateAsync(input);

      if (!unwrap(response)) {
        reportFailure(response.error);
        return false;
      }

      await invalidateMoney();
      toast.success(t("withdraw.success"));

      return true;
    } catch {
      reportFailure(null);
      return false;
    }
  }

  return {
    startOnboarding,
    startingOnboarding: startOnboardingMutation.isPending,
    refreshConnectStatus,
    refreshingConnectStatus: refreshConnectStatusMutation.isPending,
    createPaymentLink,
    creatingPaymentLink: createPaymentLinkMutation.isPending,
    requestWithdrawal,
    requestingWithdrawal: requestWithdrawalMutation.isPending,
  };
}
