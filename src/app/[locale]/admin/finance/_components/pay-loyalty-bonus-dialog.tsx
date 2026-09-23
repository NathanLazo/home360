"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import type { LoyaltyBonusRow } from "./finance.types";
import { LoyaltyPayoutMethod } from "@generated/prisma";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

export function PayLoyaltyBonusDialog({
  bonus,
  loading,
  onOpenChange,
  onConfirm,
}: {
  bonus: LoyaltyBonusRow | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    bonusId: string;
    method: LoyaltyPayoutMethod;
    notes?: string;
  }) => void;
}) {
  const t = useTranslations("admin.finance.loyalty.payDialog");
  const methodsT = useTranslations("admin.loyaltyPayoutMethod");
  const formatter = useFormatter();
  const [method, setMethod] = useState<LoyaltyPayoutMethod>(
    LoyaltyPayoutMethod.VOUCHER,
  );
  const [notes, setNotes] = useState("");
  const fieldId = useId();

  useEffect(() => {
    if (bonus === null) {
      setMethod(LoyaltyPayoutMethod.VOUCHER);
      setNotes("");
    }
  }, [bonus]);

  return (
    <Dialog open={bonus !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {bonus
              ? t("description", {
                  amount: formatter.number(bonus.amountCents / 100, {
                    style: "currency",
                    currency: "MXN",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                  business: bonus.business.name,
                })
              : t("title")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-method`}>{t("method")}</Label>
            <Select
              value={method}
              onValueChange={(value) =>
                setMethod(
                  value === LoyaltyPayoutMethod.TRANSFER
                    ? LoyaltyPayoutMethod.TRANSFER
                    : LoyaltyPayoutMethod.VOUCHER,
                )
              }
            >
              <SelectTrigger id={`${fieldId}-method`} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LoyaltyPayoutMethod).map((option) => (
                  <SelectItem key={option} value={option}>
                    {methodsT(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-notes`}>{t("notes")}</Label>
            <Textarea
              id={`${fieldId}-notes`}
              rows={3}
              value={notes}
              placeholder={t("notesPlaceholder")}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <p className="text-muted-foreground text-xs">{t("outsideNote")}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            metal="live"
            disabled={loading || bonus === null}
            onClick={() => {
              if (bonus) {
                onConfirm({
                  bonusId: bonus.id,
                  method,
                  ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
                });
              }
            }}
          >
            {loading ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
