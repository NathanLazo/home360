"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CorporateTier } from "@generated/prisma";
import type { CorporateMembershipSummary } from "../../_components/corporate.types";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

const TIERS = Object.values(CorporateTier);

export type TierChangeDialogProps = {
  membership: CorporateMembershipSummary;
  canMutate: boolean;
};

/**
 * Opens a tier-change *request* reviewed by the team — the dialog copy makes
 * explicit that nothing changes immediately (F7-05: `requestTierChange`
 * never mutates the tier). While a request is pending the trigger is
 * replaced by the pending notice, so a duplicate cannot even be attempted.
 */
export function TierChangeDialog({
  membership,
  canMutate,
}: TierChangeDialogProps) {
  const t = useTranslations("corporate.membership.change");
  const tierT = useTranslations("corporate.tier");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<CorporateTier>(membership.tier);
  const [notes, setNotes] = useState("");
  const mutation = api.corporate.requestTierChange.useMutation();

  if (membership.pendingRequest) {
    return (
      <p
        role="status"
        className="border-border bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
      >
        {t("pendingNotice", {
          tier: tierT(membership.pendingRequest.requestedTier),
        })}
      </p>
    );
  }

  if (!canMutate) {
    return null;
  }

  async function submit() {
    try {
      const trimmedNotes = notes.trim();
      const response = await mutation.mutateAsync({
        tier,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      });

      if (response.error !== null || !response.result) {
        toast.error(
          response.error === "CONFLICT"
            ? t("alreadyPending")
            : response.error !== null
              ? errorsT(response.error)
              : t("requestError"),
        );
        return;
      }

      toast.success(t("requested"));
      setOpen(false);
      setNotes("");
      await utils.corporate.getMembership.invalidate();
    } catch {
      toast.error(t("requestError"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (mutation.isPending) return;
        setOpen(nextOpen);
        if (nextOpen) setTier(membership.tier);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tier-change-tier">{t("tierLabel")}</Label>
            <Select
              value={tier}
              onValueChange={(value) => {
                const nextTier = TIERS.find(
                  (candidate) => candidate === value,
                );
                if (nextTier) setTier(nextTier);
              }}
            >
              <SelectTrigger
                id="tier-change-tier"
                className="min-h-11 w-full sm:min-h-10"
                disabled={mutation.isPending}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {tierT(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tier-change-notes">{t("notesLabel")}</Label>
            <Textarea
              id="tier-change-notes"
              value={notes}
              maxLength={500}
              rows={4}
              placeholder={t("notesPlaceholder")}
              disabled={mutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={mutation.isPending}
            >
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={() => void submit()}
          >
            {mutation.isPending ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
