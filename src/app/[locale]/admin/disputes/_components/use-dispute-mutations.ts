"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type {
  RequestDisputeEvidenceInput,
  ResolveDisputeInput,
} from "./disputes.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type DisputeMutations = {
  resolve: (input: ResolveDisputeInput) => void;
  requestEvidence: (input: RequestDisputeEvidenceInput) => void;
  generateSummary: (disputeId: string) => void;
  pending: boolean;
  requestingEvidence: boolean;
  generatingSummary: boolean;
};

/**
 * Resolving a dispute moves money, so it invalidates the list, the open file
 * and the overview namespace (which feeds the sidebar badge). Requesting
 * evidence changes the status (list + file); the AI summary only the file.
 */
export function useDisputeMutations(options?: {
  onResolved?: () => void;
  onEvidenceRequested?: () => void;
}): DisputeMutations {
  const t = useTranslations("admin.disputes.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const resolve = api.admin.disputes.resolve.useMutation({
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

  const requestEvidence = api.admin.disputes.requestEvidence.useMutation({
    onMutate: () => feedback.start("evidence", t("requestingEvidence")),
    onSuccess: async (response) => {
      if (response.error !== null) {
        feedback.error("evidence", errorsT(response.error));
        return;
      }

      feedback.success("evidence", t("evidenceRequested"));
      await Promise.all([
        utils.admin.disputes.list.invalidate(),
        utils.admin.disputes.getById.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      options?.onEvidenceRequested?.();
    },
    onError: (error) => feedback.error("evidence", errorsT(toErrorCode(error))),
  });

  const generateSummary = api.admin.disputes.generateSummary.useMutation({
    onMutate: () => feedback.start("summary", t("generatingSummary")),
    onSuccess: async (response) => {
      if (response.error !== null) {
        feedback.error("summary", errorsT(response.error));
        return;
      }

      feedback.success("summary", t("summaryGenerated"));
      await utils.admin.disputes.getById.invalidate();
    },
    onError: (error) => feedback.error("summary", errorsT(toErrorCode(error))),
  });

  return {
    resolve: (input) => resolve.mutate(input),
    requestEvidence: (input) => requestEvidence.mutate(input),
    generateSummary: (disputeId) => generateSummary.mutate({ disputeId }),
    pending: resolve.isPending,
    requestingEvidence: requestEvidence.isPending,
    generatingSummary: generateSummary.isPending,
  };
}
