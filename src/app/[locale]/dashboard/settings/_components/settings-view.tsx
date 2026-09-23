"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { BusinessProfileForm } from "./business-profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { OwnerAccountForm } from "./owner-account-form";
import { SettingsSkeleton } from "./settings-skeleton";
import { useSettingsMutations } from "./use-settings-mutations";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";

export function SettingsView() {
  const t = useTranslations("dashboard.settings");
  const errors = useTranslations("errors");
  const settingsQuery = api.businessSettings.get.useQuery();
  const mutations = useSettingsMutations();
  const response = settingsQuery.data;
  const settings = response?.result ?? null;

  if (settingsQuery.isPending) {
    return <SettingsSkeleton />;
  }

  if (settingsQuery.error ?? response?.error ?? settings === null) {
    const code = response?.error ?? null;
    return (
      <EmptyState
        icon={TriangleAlertIcon}
        title={t("queryErrorTitle")}
        description={code ? errors(code) : t("queryErrorDescription")}
        action={
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void settingsQuery.refetch()}
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="flex max-w-[40rem] flex-col gap-6">
        <BusinessProfileForm
          profile={settings.business}
          saving={mutations.savingProfile}
          onSubmit={mutations.updateBusinessProfile}
        />

        <Card>
          <CardHeader>
            <h2 className="leading-none font-semibold">{t("account.title")}</h2>
            <CardDescription>{t("account.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <OwnerAccountForm
              ownerName={settings.owner.name ?? ""}
              ownerEmail={settings.owner.email}
              saving={mutations.savingOwner}
              onSubmit={mutations.updateOwner}
            />
            <Separator />
            <ChangePasswordForm
              saving={mutations.savingPassword}
              onSubmit={mutations.changePassword}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
