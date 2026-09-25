"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProfileLinkedAccounts } from "./profile-linked-accounts";
import { ProfilePasswordForm } from "./profile-password-form";
import { ProfileSectionCard } from "./profile-section-card";
import { ProfileSignOutEverywhere } from "./profile-sign-out-everywhere";
import type { MutationOutcome, ProfileSummary } from "./profile.types";
import type { SetPasswordInput } from "~/schemas/profile/profile.schema";
import { Separator } from "~/components/ui/separator";

export function ProfileSecurityCard({
  profile,
  disabled,
  savingPassword,
  signingOutEverywhere,
  onSetPassword,
  onSignOutEverywhere,
}: {
  profile: ProfileSummary;
  disabled: boolean;
  savingPassword: boolean;
  signingOutEverywhere: boolean;
  onSetPassword: (input: SetPasswordInput) => Promise<MutationOutcome>;
  onSignOutEverywhere: () => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.security");

  return (
    <ProfileSectionCard
      id="security"
      title={t("title")}
      description={t("description")}
      icon={ShieldCheckIcon}
    >
      <ProfilePasswordForm
        hasPassword={profile.hasPassword}
        disabled={disabled}
        saving={savingPassword}
        onSubmit={onSetPassword}
      />
      <Separator />
      <ProfileLinkedAccounts providers={profile.linkedProviders} />
      <Separator />
      <ProfileSignOutEverywhere
        disabled={disabled}
        pending={signingOutEverywhere}
        onConfirm={onSignOutEverywhere}
      />
    </ProfileSectionCard>
  );
}
