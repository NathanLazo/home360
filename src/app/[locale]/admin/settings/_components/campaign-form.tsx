"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  CAMPAIGN_BODY_MAX_LENGTH,
  CAMPAIGN_TITLE_MAX_LENGTH,
  campaignAudienceSchema,
  sendCampaignSchema,
  type SendCampaignInput,
} from "./campaigns.schema";
import { CampaignAudience } from "@generated/prisma";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

const EMPTY: SendCampaignInput = {
  title: "",
  body: "",
  audience: CampaignAudience.ALL,
};

/**
 * Manual broadcast form. A push reaches real phones and cannot be recalled,
 * so sending always goes through an explicit confirmation naming the
 * audience.
 */
export function CampaignForm({
  sending,
  onSend,
}: {
  sending: boolean;
  onSend: (input: SendCampaignInput, reset: () => void) => void;
}) {
  const t = useTranslations("admin.settings.campaigns");
  const audienceT = useTranslations("admin.settings.campaigns.audience");
  const [values, setValues] = useState<SendCampaignInput>(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const fieldId = useId();
  const parsed = sendCampaignSchema.safeParse(values);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (parsed.success && !sending) {
          setConfirming(true);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-title`}>{t("titleLabel")}</Label>
          <Input
            id={`${fieldId}-title`}
            required
            maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
            value={values.title}
            placeholder={t("titlePlaceholder")}
            onChange={(event) =>
              setValues({ ...values, title: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-audience`}>{t("audienceLabel")}</Label>
          <Select
            value={values.audience}
            onValueChange={(value) =>
              setValues({
                ...values,
                audience: campaignAudienceSchema.parse(value),
              })
            }
          >
            <SelectTrigger id={`${fieldId}-audience`} className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CampaignAudience).map((option) => (
                <SelectItem key={option} value={option}>
                  {audienceT(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-body`}>{t("bodyLabel")}</Label>
        <Textarea
          id={`${fieldId}-body`}
          required
          rows={3}
          maxLength={CAMPAIGN_BODY_MAX_LENGTH}
          value={values.body}
          placeholder={t("bodyPlaceholder")}
          aria-describedby={`${fieldId}-body-hint`}
          onChange={(event) =>
            setValues({ ...values, body: event.target.value })
          }
        />
        <p
          id={`${fieldId}-body-hint`}
          className="text-muted-foreground font-mono text-xs tabular-nums"
        >
          {t("bodyCount", {
            count: values.body.length,
            max: CAMPAIGN_BODY_MAX_LENGTH,
          })}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          disabled={!parsed.success || sending}
        >
          <SendIcon aria-hidden="true" />
          {t("send")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!sending) {
            setConfirming(open);
          }
        }}
        title={t("confirmTitle")}
        description={t("confirmDescription", {
          audience: audienceT(values.audience),
          title: values.title.trim(),
        })}
        confirmLabel={t("send")}
        cancelLabel={t("cancel")}
        loading={sending}
        onConfirm={() => {
          if (parsed.success) {
            onSend(parsed.data, () => {
              setValues(EMPTY);
              setConfirming(false);
            });
          }
        }}
      />
    </form>
  );
}
