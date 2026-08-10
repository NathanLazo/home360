"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

  const mutation = api.admin.disputes.resolve.useMutation({
    onSuccess: async (response) => {
      if (response.error !== null) {
        toast.error(errorsT(response.error));
        return;
      }

      toast.success(t("resolved"));
      await Promise.all([
        utils.admin.disputes.list.invalidate(),
        utils.admin.disputes.getById.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      options?.onResolved?.();
    },
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  return {
    resolve: (input) => mutation.mutate(input),
    pending: mutation.isPending,
  };
}
