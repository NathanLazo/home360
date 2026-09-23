"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { ReactivateUserInput, SuspendUserInput } from "./users.schema";
import type { ErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

type MutationRunner<TInput> = {
  run: (input: TInput) => void;
  pending: boolean;
};

export type UserAccessMutations = {
  suspend: MutationRunner<SuspendUserInput>;
  reactivate: MutationRunner<ReactivateUserInput>;
};

/**
 * Suspend/reactivate a customer or worker account. Both refresh the list
 * (status column) and the customer sheet, never the business surfaces.
 */
export function useUserAccessMutations(options?: {
  onSettledSuccess?: () => void;
}): UserAccessMutations {
  const t = useTranslations("admin.users.access.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  type ToastKey = "suspended" | "reactivated";

  const lifecycle = (key: ToastKey) => ({
    onMutate: () => feedback.start(key, t(`pending.${key}`)),
    onSuccess: (response: { error: ErrorCode | null }) => {
      if (response.error !== null) {
        feedback.error(key, errorsT(response.error));
        return;
      }

      feedback.success(key, t(key));
      void Promise.all([
        utils.admin.users.list.invalidate(),
        utils.admin.users.getCustomerDetail.invalidate(),
      ]);
      options?.onSettledSuccess?.();
    },
    onError: (error: unknown) =>
      feedback.error(key, errorsT(toErrorCode(error))),
  });

  const suspend = api.admin.users.suspendUser.useMutation(
    lifecycle("suspended"),
  );
  const reactivate = api.admin.users.reactivateUser.useMutation(
    lifecycle("reactivated"),
  );

  return {
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
