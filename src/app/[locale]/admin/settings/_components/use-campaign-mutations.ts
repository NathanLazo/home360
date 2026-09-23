"use client";

import { useTranslations } from "next-intl";

import { useMutationFeedback } from "../../_components/use-mutation-feedback";
import type { SendCampaignInput } from "./campaigns.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type CampaignMutations = {
  send: (input: SendCampaignInput) => void;
  sending: boolean;
};

export function useCampaignMutations(options?: {
  onSent?: () => void;
}): CampaignMutations {
  const t = useTranslations("admin.settings.campaigns.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const feedback = useMutationFeedback();

  const mutation = api.admin.settings.sendCampaign.useMutation({
    onMutate: () => feedback.start("campaign", t("sending")),
    onSuccess: async (response) => {
      if (response.error !== null || response.result === null) {
        feedback.error("campaign", errorsT(response.error ?? "UNKNOWN_ERROR"));
        return;
      }

      feedback.success(
        "campaign",
        t("sent", { count: response.result.recipientCount }),
      );
      await utils.admin.settings.listCampaigns.invalidate();
      options?.onSent?.();
    },
    onError: (error) => feedback.error("campaign", errorsT(toErrorCode(error))),
  });

  return {
    send: (input) => mutation.mutate(input),
    sending: mutation.isPending,
  };
}
