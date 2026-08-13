"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  CreateCorporateAccountInput,
  UpdateCorporateTermsInput,
} from "./corporate.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

type MutationRunner<TInput> = {
  run: (input: TInput) => void;
  pending: boolean;
};

export type CorporateMutations = {
  create: MutationRunner<CreateCorporateAccountInput>;
  activate: MutationRunner<{ accountId: string }>;
  updateTerms: MutationRunner<UpdateCorporateTermsInput>;
  suspend: MutationRunner<{ accountId: string; reason: string }>;
  reactivate: MutationRunner<{ accountId: string }>;
  reconcileBilling: MutationRunner<{ accountId: string }>;
  rejectTierChange: MutationRunner<{
    accountId: string;
    requestId: string;
    reason: string;
  }>;
};

/**
 * Every corporate mutation invalidates the same two read surfaces (the list
 * with its counts and the open detail sheet) so they can never disagree.
 * No optimistic update anywhere: activation, suspension and terms all talk to
 * Stripe and may legitimately fail.
 */
export function useCorporateMutations(options?: {
  onSettledSuccess?: () => void;
}): CorporateMutations {
  const t = useTranslations("admin.corporate.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.corporate.list.invalidate(),
      utils.admin.corporate.getById.invalidate(),
    ]);
  };

  // The corporate namespace adds codes (EMAIL_TAKEN, PLAN_NOT_SYNCED,
  // EMAIL_DELIVERY_FAILED) beyond the base contract union; every one of them
  // exists in `errors.json`, so the translation channel stays uniform.
  const handleEnvelope = (
    error: string | null,
    successKey: string,
  ): boolean => {
    if (error !== null) {
      toast.error(errorsT(error));
      return false;
    }

    toast.success(t(successKey));
    void invalidate();
    options?.onSettledSuccess?.();
    return true;
  };

  const onTransportError = (error: unknown) => {
    toast.error(errorsT(toErrorCode(error)));
  };

  const create = api.admin.corporate.create.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "created"),
    onError: onTransportError,
  });

  const activate = api.admin.corporate.activate.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "activated"),
    onError: onTransportError,
  });

  const updateTerms = api.admin.corporate.updateTerms.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "termsUpdated"),
    onError: onTransportError,
  });

  const suspend = api.admin.corporate.suspend.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "suspended"),
    onError: onTransportError,
  });

  const reactivate = api.admin.corporate.reactivate.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "reactivated"),
    onError: onTransportError,
  });

  const reconcileBilling = api.admin.corporate.reconcileBilling.useMutation({
    onSuccess: (response) =>
      handleEnvelope(response.error, "billingReconciled"),
    onError: onTransportError,
  });

  const rejectTierChange = api.admin.corporate.rejectTierChange.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "requestRejected"),
    onError: onTransportError,
  });

  return {
    create: {
      run: (input) => create.mutate(input),
      pending: create.isPending,
    },
    activate: {
      run: (input) => activate.mutate(input),
      pending: activate.isPending,
    },
    updateTerms: {
      run: (input) => updateTerms.mutate(input),
      pending: updateTerms.isPending,
    },
    suspend: {
      run: (input) => suspend.mutate(input),
      pending: suspend.isPending,
    },
    reactivate: {
      run: (input) => reactivate.mutate(input),
      pending: reactivate.isPending,
    },
    reconcileBilling: {
      run: (input) => reconcileBilling.mutate(input),
      pending: reconcileBilling.isPending,
    },
    rejectTierChange: {
      run: (input) => rejectTierChange.mutate(input),
      pending: rejectTierChange.isPending,
    },
  };
}
