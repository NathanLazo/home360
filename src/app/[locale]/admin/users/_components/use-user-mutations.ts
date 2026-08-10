"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

  const invalidate = async () => {
    await Promise.all([
      utils.admin.users.list.invalidate(),
      utils.admin.users.getBusinessDetail.invalidate(),
      utils.admin.overview.invalidate(),
    ]);
  };

  const handleEnvelope = (
    error: ErrorCode | null,
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

  const approve = api.admin.users.approveBusiness.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "approved"),
    onError: onTransportError,
  });

  const reject = api.admin.users.rejectBusiness.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "rejected"),
    onError: onTransportError,
  });

  const suspend = api.admin.users.suspendBusiness.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "suspended"),
    onError: onTransportError,
  });

  const reactivate = api.admin.users.reactivateBusiness.useMutation({
    onSuccess: (response) => handleEnvelope(response.error, "reactivated"),
    onError: onTransportError,
  });

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
  };
}
