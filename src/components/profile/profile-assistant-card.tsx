"use client";

import { useState, type FormEvent } from "react";
import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProfileFormStatus } from "./profile-form-status";
import { ProfileModelPicker } from "./profile-model-picker";
import { ProfileModelUsage } from "./profile-model-usage";
import { ProfileNotice } from "./profile-notice";
import { ProfileSectionCard } from "./profile-section-card";
import { updateAssistantPreferencesSchema } from "./profile.form-schema";
import {
  SAVED_FEEDBACK_MS,
  type AiModelUsage,
  type MutationOutcome,
} from "./profile.types";
import type { AgentModelId } from "~/lib/agent/agent-models";
import type { UpdateAssistantPreferencesInput } from "~/schemas/profile/profile.schema";
import { SubmitStatusIcon, useTransientFlag } from "~/components/motion";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";

export function ProfileAssistantCard({
  defaultModel,
  available,
  disabled,
  saving,
  usage,
  onSubmit,
}: {
  defaultModel: AgentModelId;
  /** False without a gateway key: the section explains it instead. */
  available: boolean;
  disabled: boolean;
  saving: boolean;
  /** `undefined` while the billing summary loads; `null` when it failed. */
  usage: AiModelUsage[] | null | undefined;
  onSubmit: (
    input: UpdateAssistantPreferencesInput,
  ) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.assistant");
  const notices = useTranslations("profile");
  const [model, setModel] = useState<AgentModelId>(defaultModel);
  const isDirty = model !== defaultModel;
  const pending = saving || disabled;
  const [saved, flashSaved] = useTransientFlag(SAVED_FEEDBACK_MS);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateAssistantPreferencesSchema.safeParse({
      agentDefaultModel: model,
    });
    if (!parsed.success) return;
    const outcome = await onSubmit(parsed.data);
    if (outcome.ok) flashSaved();
  }

  return (
    <ProfileSectionCard
      id="assistant"
      title={t("title")}
      description={t("description")}
      icon={SparklesIcon}
    >
      {!available ? (
        <ProfileNotice>{notices("notConfigured")}</ProfileNotice>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            <ProfileModelPicker
              name="agentDefaultModel"
              value={model}
              disabled={pending}
              onChange={setModel}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ProfileFormStatus
                dirty={isDirty}
                dirtyLabel={t("unsaved")}
                cleanLabel={t("upToDate")}
              />
              <Button
                type="submit"
                disabled={pending || !isDirty}
                className="w-full sm:w-auto"
              >
                <SubmitStatusIcon pending={saving} succeeded={saved} />
                {t("save")}
              </Button>
            </div>
          </form>

          {usage === null ? null : (
            <>
              <Separator />
              {usage === undefined ? (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <ProfileModelUsage usage={usage} />
              )}
            </>
          )}
        </>
      )}
    </ProfileSectionCard>
  );
}
