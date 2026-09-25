"use client";

import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProfileIdentityForm } from "./profile-identity-form";
import { ProfileSectionCard } from "./profile-section-card";
import type { MutationOutcome, ProfileSummary } from "./profile.types";
import type { UpdateIdentityInput } from "~/schemas/profile/profile.schema";

export function ProfileAccountCard({
  profile,
  disabled,
  saving,
  onSubmit,
}: {
  profile: ProfileSummary;
  disabled: boolean;
  saving: boolean;
  onSubmit: (input: UpdateIdentityInput) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.account");

  return (
    <ProfileSectionCard
      id="account"
      title={t("title")}
      description={t("description")}
      icon={UserRoundIcon}
    >
      <ProfileIdentityForm
        profile={profile}
        disabled={disabled}
        saving={saving}
        onSubmit={onSubmit}
      />
    </ProfileSectionCard>
  );
}
