"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { ReportAction } from "./reports.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

/** Resolving a report changes the queue in both tabs; one toast per action. */
export function useReportMutations() {
  const t = useTranslations("admin.reports.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const resolve = api.admin.reports.resolve.useMutation({
    onMutate: () => feedback.start("resolve", t("resolving")),
    onSuccess: async (response) => {
      if (response.error !== null) {
        feedback.error("resolve", errorsT(response.error));
        return;
      }

      feedback.success("resolve", t("resolved"));
      await utils.admin.reports.list.invalidate();
    },
    onError: (error) => feedback.error("resolve", errorsT(toErrorCode(error))),
  });

  return {
    resolve: (reportId: string, action: ReportAction) =>
      resolve.mutate({ reportId, action }),
    pendingId: resolve.isPending ? resolve.variables?.reportId : undefined,
  };
}
