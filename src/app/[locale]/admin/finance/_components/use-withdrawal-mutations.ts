"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type WithdrawalMutations = {
  approve: (input: { withdrawalId: string }) => void;
  reject: (input: { withdrawalId: string; reason: string }) => void;
  pending: boolean;
};

export function useWithdrawalMutations(options?: {
  onSettled?: () => void;
}): WithdrawalMutations {
  const t = useTranslations("admin.finance.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.finance.getKpis.invalidate(),
      utils.admin.finance.listWithdrawals.invalidate(),
    ]);
  };

  const handle = (
    error: Parameters<typeof errorsT>[0] | null,
    successKey: "approved" | "rejected",
  ) => {
    if (error !== null) {
      toast.error(errorsT(error));
      return;
    }

    toast.success(t(successKey));
    void invalidate();
    options?.onSettled?.();
  };

  const approve = api.admin.finance.approveWithdrawal.useMutation({
    onSuccess: (response) => handle(response.error, "approved"),
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  const reject = api.admin.finance.rejectWithdrawal.useMutation({
    onSuccess: (response) => handle(response.error, "rejected"),
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  return {
    approve: (input) => approve.mutate(input),
    reject: (input) => reject.mutate(input),
    pending: approve.isPending || reject.isPending,
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

  const invalidate = async () => {
    await Promise.all([
      utils.admin.finance.listLoyaltyBonuses.invalidate(),
      utils.admin.finance.getRevenueBreakdown.invalidate(),
    ]);
  };

  const handle = (
    error: Parameters<typeof errorsT>[0] | null,
    successKey: "paid" | "cancelled",
  ) => {
    if (error !== null) {
      toast.error(errorsT(error));
      return;
    }

    toast.success(t(successKey));
    void invalidate();
    options?.onSettled?.();
  };

  const pay = api.admin.finance.payLoyaltyBonus.useMutation({
    onSuccess: (response) => handle(response.error, "paid"),
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  const cancel = api.admin.finance.cancelLoyaltyBonus.useMutation({
    onSuccess: (response) => handle(response.error, "cancelled"),
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  return {
    pay: (input) => pay.mutate(input),
    cancel: (input) => cancel.mutate(input),
    pending: pay.isPending || cancel.isPending,
  };
}
