"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CorporateMembershipSummary } from "../../_components/corporate.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export type PendingTierRequestNoticeProps = {
  pendingRequest: NonNullable<CorporateMembershipSummary["pendingRequest"]>;
  canMutate: boolean;
};

/** Pending tier-change notice with the option to withdraw the request. */
export function PendingTierRequestNotice({
  pendingRequest,
  canMutate,
}: PendingTierRequestNoticeProps) {
  const t = useTranslations("corporate.membership.change");
  const tierT = useTranslations("corporate.tier");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = api.corporate.cancelTierChangeRequest.useMutation();

  async function withdraw() {
    try {
      const response = await mutation.mutateAsync();

      if (response.error !== null) {
        toast.error(errorsT(response.error));
        return;
      }

      toast.success(t("withdrawn"));
      setConfirmOpen(false);
      await utils.corporate.getMembership.invalidate();
    } catch {
      toast.error(t("withdrawError"));
    }
  }

  return (
    <div
      role="status"
      className="bg-canvas-soft text-copy-sm flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground">
        {t("pendingNotice", { tier: tierT(pendingRequest.requestedTier) })}
      </p>
      {canMutate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 shrink-0"
          disabled={mutation.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {t("withdraw")}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("withdrawDialog.title")}
        description={t("withdrawDialog.description")}
        confirmLabel={t("withdrawDialog.confirm")}
        cancelLabel={t("withdrawDialog.cancel")}
        destructive
        loading={mutation.isPending}
        onConfirm={() => void withdraw()}
      />
    </div>
  );
}
