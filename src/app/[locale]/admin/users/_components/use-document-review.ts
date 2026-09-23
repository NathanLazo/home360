"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { ReviewDocumentInput } from "./users.schema";
import type { ErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type DocumentReview = {
  run: (input: ReviewDocumentInput) => void;
  /** Document currently being reviewed, so only its buttons show progress. */
  pendingDocumentId: string | null;
};

/**
 * Per-document KYC verdict. Refreshes the sheet (and the approval dialog,
 * which reads the same detail query) plus the list's pending-docs count.
 */
export function useDocumentReview(options?: {
  onSuccess?: () => void;
}): DocumentReview {
  const t = useTranslations("admin.users.documents.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const mutation = api.admin.users.reviewDocument.useMutation({
    onMutate: (input) =>
      feedback.start(input.documentId, t(`pending.${input.status}`)),
    onSuccess: (response: { error: ErrorCode | null }, input) => {
      if (response.error !== null) {
        feedback.error(input.documentId, errorsT(response.error));
        return;
      }

      feedback.success(input.documentId, t(input.status));
      void Promise.all([
        utils.admin.users.getBusinessDetail.invalidate(),
        utils.admin.users.list.invalidate(),
      ]);
      options?.onSuccess?.();
    },
    onError: (error, input) =>
      feedback.error(input.documentId, errorsT(toErrorCode(error))),
  });

  return {
    run: (input) => mutation.mutate(input),
    pendingDocumentId: mutation.isPending
      ? (mutation.variables?.documentId ?? null)
      : null,
  };
}
