"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { ResolveDisputeInput } from "./disputes.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type DisputeMutations = {
  resolve: (input: ResolveDisputeInput) => void;
  pending: boolean;
};

/**
 * Resolving a dispute moves money, so it invalidates the list, the open file
 * and the overview namespace (which feeds the sidebar badge).
 */
export function useDisputeMutations(options?: {
  onResolved?: () => void;
}): DisputeMutations {
  const t = useTranslations("admin.disputes.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const mutation = api.admin.disputes.resolve.useMutation({
    onMutate: () => feedback.start("resolve", t("resolving")),
    onSuccess: async (response) => {
      if (response.error !== null) {
        feedback.error("resolve", errorsT(response.error));
        return;
      }

      feedback.success("resolve", t("resolved"));
      await Promise.all([
        utils.admin.disputes.list.invalidate(),
        utils.admin.disputes.getById.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      options?.onResolved?.();
    },
    onError: (error) => feedback.error("resolve", errorsT(toErrorCode(error))),
  });

  return {
    resolve: (input) => mutation.mutate(input),
    pending: mutation.isPending,
  };
}
