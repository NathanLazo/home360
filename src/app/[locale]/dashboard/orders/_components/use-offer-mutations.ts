"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { api } from "~/trpc/react";

export type SubmitOfferInput = {
  requestId: string;
  workerId: string;
  priceCents: number;
  scheduledAt: Date;
  message?: string;
  branchId?: string;
};

/** Offer (quote) mutations shared by the requests and "my offers" tabs. */
export function useOfferMutations() {
  const t = useTranslations("dashboard.requests.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const submitMutation = api.quote.submit.useMutation();
  const withdrawMutation = api.quote.withdraw.useMutation();

  async function refresh() {
    await Promise.all([
      utils.radar.listOpenRequests.invalidate(),
      utils.radar.getRequest.invalidate(),
      utils.quote.listMine.invalidate(),
    ]);
  }

  async function submit(input: SubmitOfferInput): Promise<boolean> {
    try {
      const response = await submitMutation.mutateAsync(input);

      if (response.error !== null || response.result === null) {
        toast.error(
          response.error ? errors(response.error) : t("transportError"),
        );
        return false;
      }

      toast.success(t(response.result.updated ? "offerUpdated" : "offerSent"));
      await refresh();
      return true;
    } catch {
      toast.error(t("transportError"));
      return false;
    }
  }

  async function withdraw(quoteId: string): Promise<boolean> {
    try {
      const response = await withdrawMutation.mutateAsync({ id: quoteId });

      if (response.error !== null || response.result === null) {
        toast.error(
          response.error ? errors(response.error) : t("transportError"),
        );
        return false;
      }

      toast.success(t("offerWithdrawn"));
      await refresh();
      return true;
    } catch {
      toast.error(t("transportError"));
      return false;
    }
  }

  return {
    submit,
    withdraw,
    submitting: submitMutation.isPending,
    withdrawing: withdrawMutation.isPending,
  };
}
