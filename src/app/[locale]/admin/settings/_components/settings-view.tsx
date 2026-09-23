"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { AiSettingsSection } from "./ai-settings-section";
import { CampaignsSection } from "./campaigns-section";
import { EscrowSettingsSection } from "./escrow-settings-section";
import { FeesSettingsSection } from "./fees-settings-section";
import { NotificationsSettingsSection } from "./notifications-settings-section";
import { SettingsSaveBar } from "./settings-save-bar";
import { SettingsSkeleton } from "./settings-skeleton";
import { useSettingsMutations } from "./use-settings-mutations";
import { settingsFormSchema, type SettingsFormValues } from "./settings.form";
import { toFormValues, toSaveInput } from "./settings.mappers";
import type { PlatformSettingsResult } from "./settings.types";
import { useErrorShake } from "~/components/motion";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

function SettingsForm({ data }: { data: PlatformSettingsResult }) {
  const t = useTranslations("admin.settings");
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues(data),
  });
  const mutations = useSettingsMutations();

  // A refetch (including the one forced by SETTINGS_STALE) re-seeds the form
  // with the authoritative server values.
  useEffect(() => {
    form.reset(toFormValues(data));
  }, [data, form]);

  const formRef = useRef<HTMLFormElement>(null);
  const shakeInvalid = useErrorShake();

  // Invalid submit: react-hook-form focuses the first bad field and renders
  // the messages; the shake points at every field that still needs fixing.
  const onSubmit = form.handleSubmit(
    (values) => {
      const input = toSaveInput(values, data);

      if (input) {
        mutations.save(input);
      }
    },
    () => shakeInvalid(formRef.current),
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6">
      <AiSettingsSection form={form} />
      <FeesSettingsSection form={form} />
      <EscrowSettingsSection form={form} />
      <NotificationsSettingsSection form={form} />
      <SettingsSaveBar
        dirty={form.formState.isDirty}
        saving={mutations.saving}
        onReset={() => form.reset(toFormValues(data))}
      />
      <p className="sr-only">{t("formLabel")}</p>
    </form>
  );
}

export function SettingsView() {
  const t = useTranslations("admin.settings");
  const query = api.admin.settings.get.useQuery();
  const state = unwrapEnvelope(query);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {state.status === "pending" ? (
        <SettingsSkeleton label={t("loading")} />
      ) : null}

      {state.status === "error" ? (
        <SectionError
          title={
            state.code === "NOT_FOUND" ? t("notSeededTitle") : t("errorTitle")
          }
          code={state.code}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {state.status === "success" ? <SettingsForm data={state.data} /> : null}

      {/* Independent of the form: broadcasting never waits on "Guardar". */}
      <CampaignsSection />
    </div>
  );
}
