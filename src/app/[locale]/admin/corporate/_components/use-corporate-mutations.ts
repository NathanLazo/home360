"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
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
  const feedback = useMutationFeedback();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.corporate.list.invalidate(),
      utils.admin.corporate.getById.invalidate(),
    ]);
  };

  type ToastKey =
    | "created"
    | "activated"
    | "termsUpdated"
    | "suspended"
    | "reactivated"
    | "billingReconciled"
    | "requestRejected";

  // The corporate namespace adds codes (EMAIL_TAKEN, PLAN_NOT_SYNCED,
  // EMAIL_DELIVERY_FAILED) beyond the base contract union; every one of them
  // exists in `errors.json`, so the translation channel stays uniform.
  // These calls talk to Stripe and can take a moment: a loading toast opens
  // on click and morphs into the outcome in place.
  const lifecycle = (key: ToastKey) => ({
    onMutate: () => feedback.start(key, t(`pending.${key}`)),
    onSuccess: (response: { error: string | null }) => {
      if (response.error !== null) {
        feedback.error(key, errorsT(response.error));
        return;
      }

      feedback.success(key, t(key));
      void invalidate();
      options?.onSettledSuccess?.();
    },
    onError: (error: unknown) =>
      feedback.error(key, errorsT(toErrorCode(error))),
  });

  const create = api.admin.corporate.create.useMutation(lifecycle("created"));
  const activate = api.admin.corporate.activate.useMutation(
    lifecycle("activated"),
  );
  const updateTerms = api.admin.corporate.updateTerms.useMutation(
    lifecycle("termsUpdated"),
  );
  const suspend = api.admin.corporate.suspend.useMutation(
    lifecycle("suspended"),
  );
  const reactivate = api.admin.corporate.reactivate.useMutation(
    lifecycle("reactivated"),
  );
  const reconcileBilling = api.admin.corporate.reconcileBilling.useMutation(
    lifecycle("billingReconciled"),
  );
  const rejectTierChange = api.admin.corporate.rejectTierChange.useMutation(
    lifecycle("requestRejected"),
  );

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
