"use client";

import { useLocale, useTranslations } from "next-intl";

import { useMutationFeedback } from "./use-mutation-feedback";
import { getPathname } from "~/i18n/navigation";
import { toErrorCode } from "~/lib/trpc-errors";
import type { ImpersonationSubject } from "~/schemas/admin/impersonation.schema";
import { api } from "~/trpc/react";

const FEEDBACK_KEY = "impersonation";

export type StartImpersonation = {
  start: (subject: ImpersonationSubject, subjectId: string) => void;
  pending: boolean;
};

/**
 * Opens a business or corporate panel as its owner (read-only). On success
 * it hard-navigates so the panel renders from a clean client cache under the
 * impersonated identity; the loading toast stays up until the page unloads.
 */
export function useStartImpersonation(): StartImpersonation {
  const t = useTranslations("admin.impersonation");
  const errorsT = useTranslations("errors");
  const locale = useLocale();
  const feedback = useMutationFeedback();
  const mutation = api.admin.impersonation.start.useMutation({
    onMutate: () => feedback.start(FEEDBACK_KEY, t("opening")),
    onSuccess: (response) => {
      if (response.error !== null || response.result === null) {
        feedback.error(
          FEEDBACK_KEY,
          errorsT(response.error ?? "UNKNOWN_ERROR"),
        );
        return;
      }

      window.location.assign(
        getPathname({ href: response.result.panel, locale }),
      );
    },
    onError: (error) =>
      feedback.error(FEEDBACK_KEY, errorsT(toErrorCode(error))),
  });

  return {
    start: (subject, subjectId) => {
      if (!mutation.isPending) {
        mutation.mutate({ subject, subjectId });
      }
    },
    pending: mutation.isPending,
  };
}
