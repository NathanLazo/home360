"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type WithdrawalMutations = {
  approve: (input: { withdrawalId: string }) => void;
  /** Re-drives a PROCESSING payout through the same idempotent approval. */
  retry: (input: { withdrawalId: string }) => void;
  reject: (input: { withdrawalId: string; reason: string }) => void;
  pending: boolean;
};

export function useWithdrawalMutations(options?: {
  onSettled?: () => void;
}): WithdrawalMutations {
  const t = useTranslations("admin.finance.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.finance.getKpis.invalidate(),
      utils.admin.finance.listWithdrawals.invalidate(),
    ]);
  };

  const lifecycle = (key: "approved" | "rejected" | "retried") => ({
    onMutate: () => feedback.start(key, t(`pending.${key}`)),
    onSuccess: (response: { error: Parameters<typeof errorsT>[0] | null }) => {
      if (response.error !== null) {
        feedback.error(key, errorsT(response.error));
        return;
      }

      feedback.success(key, t(key));
      void invalidate();
      options?.onSettled?.();
    },
    onError: (error: unknown) =>
      feedback.error(key, errorsT(toErrorCode(error))),
  });

  const approve = api.admin.finance.approveWithdrawal.useMutation(
    lifecycle("approved"),
  );
  const retry = api.admin.finance.approveWithdrawal.useMutation(
    lifecycle("retried"),
  );
  const reject = api.admin.finance.rejectWithdrawal.useMutation(
    lifecycle("rejected"),
  );

  return {
    approve: (input) => approve.mutate(input),
    retry: (input) => retry.mutate(input),
    reject: (input) => reject.mutate(input),
    pending: approve.isPending || retry.isPending || reject.isPending,
  };
}

export type LoyaltyMutations = {
  pay: (input: {
    bonusId: string;
    method: "VOUCHER" | "TRANSFER";
    notes?: string;
  }) => void;
  cancel: (input: { bonusId: string; reason: string }) => void;
  pending: boolean;
};

/**
 * Settling a bonus changes the real "loyalty bonuses paid" line, so the
 * revenue breakdown is invalidated alongside the list.
 */
export function useLoyaltyMutations(options?: {
  onSettled?: () => void;
}): LoyaltyMutations {
  const t = useTranslations("admin.finance.loyalty.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.finance.listLoyaltyBonuses.invalidate(),
      utils.admin.finance.getRevenueBreakdown.invalidate(),
    ]);
  };

  const lifecycle = (key: "paid" | "cancelled") => ({
    onMutate: () => feedback.start(key, t(`pending.${key}`)),
    onSuccess: (response: { error: Parameters<typeof errorsT>[0] | null }) => {
      if (response.error !== null) {
        feedback.error(key, errorsT(response.error));
        return;
      }

      feedback.success(key, t(key));
      void invalidate();
      options?.onSettled?.();
    },
    onError: (error: unknown) =>
      feedback.error(key, errorsT(toErrorCode(error))),
  });

  const pay = api.admin.finance.payLoyaltyBonus.useMutation(lifecycle("paid"));
  const cancel = api.admin.finance.cancelLoyaltyBonus.useMutation(
    lifecycle("cancelled"),
  );

  return {
    pay: (input) => pay.mutate(input),
    cancel: (input) => cancel.mutate(input),
    pending: pay.isPending || cancel.isPending,
  };
}
