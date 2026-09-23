"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { ApproveBusinessInput } from "./users.schema";
import type { ErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

type MutationRunner<TInput> = {
  run: (input: TInput) => void;
  pending: boolean;
};

export type UserMutations = {
  approve: MutationRunner<ApproveBusinessInput>;
  reject: MutationRunner<{ businessId: string; reason: string }>;
  suspend: MutationRunner<{ businessId: string; reason: string }>;
  reactivate: MutationRunner<{ businessId: string }>;
  reopen: MutationRunner<{ businessId: string }>;
};

/**
 * Every moderation mutation invalidates the same three read surfaces, so the
 * W10 list, the open detail sheet and the W9 counters can never disagree.
 */
export function useUserMutations(options?: {
  onSettledSuccess?: () => void;
}): UserMutations {
  const t = useTranslations("admin.users.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.users.list.invalidate(),
      utils.admin.users.getBusinessDetail.invalidate(),
      utils.admin.overview.invalidate(),
    ]);
  };

  type ToastKey =
    "approved" | "rejected" | "suspended" | "reactivated" | "reopened";

  // Each mutation opens a loading toast on click and morphs it into the
  // outcome, so the admin never wonders whether the request was sent.
  const lifecycle = (key: ToastKey) => ({
    onMutate: () => feedback.start(key, t(`pending.${key}`)),
    onSuccess: (response: { error: ErrorCode | null }) => {
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

  const approve = api.admin.users.approveBusiness.useMutation(
    lifecycle("approved"),
  );
  const reject = api.admin.users.rejectBusiness.useMutation(
    lifecycle("rejected"),
  );
  const suspend = api.admin.users.suspendBusiness.useMutation(
    lifecycle("suspended"),
  );
  const reactivate = api.admin.users.reactivateBusiness.useMutation(
    lifecycle("reactivated"),
  );
  const reopen = api.admin.users.reopenBusinessReview.useMutation(
    lifecycle("reopened"),
  );

  return {
    approve: {
      run: (input) => approve.mutate(input),
      pending: approve.isPending,
    },
    reject: {
      run: (input) => reject.mutate(input),
      pending: reject.isPending,
    },
    suspend: {
      run: (input) => suspend.mutate(input),
      pending: suspend.isPending,
    },
    reactivate: {
      run: (input) => reactivate.mutate(input),
      pending: reactivate.isPending,
    },
    reopen: {
      run: (input) => reopen.mutate(input),
      pending: reopen.isPending,
    },
  };
}
