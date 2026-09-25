"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { ProfileAccountCard } from "./profile-account-card";
import { ProfileAssistantCard } from "./profile-assistant-card";
import { ProfileBillingCard } from "./profile-billing-card";
import { ProfileDevicesCard } from "./profile-devices-card";
import { ProfileIdentityHeader } from "./profile-identity-header";
import { ProfileNotice } from "./profile-notice";
import { ProfileSectionNav } from "./profile-section-nav";
import { ProfileSecurityCard } from "./profile-security-card";
import { ProfileSkeleton } from "./profile-skeleton";
import { ProfileWorkspaceCard } from "./profile-workspace-card";
import { useProfileMutations } from "./use-profile-mutations";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import type { AgentArea } from "~/lib/agent/agent-area";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export type ProfileViewProps = {
  area: AgentArea;
  /** True while an admin impersonates: every write is refused server-side. */
  readOnly: boolean;
  /** False without a gateway key: assistant and billing explain it. */
  assistantAvailable: boolean;
};

/**
 * `/{panel}/settings/profile`: one screen shared by the three panels. The
 * shell states the panel; this view states the person. One `profile.get`
 * query drives the page; billing has its own so a Stripe failure stays local.
 */
export function ProfileView({
  area,
  readOnly,
  assistantAvailable,
}: ProfileViewProps) {
  const t = useTranslations("profile");
  const utils = api.useUtils();
  const profileQuery = api.profile.get.useQuery();
  const billingQuery = api.aiBilling.getSummary.useQuery(undefined, {
    enabled: assistantAvailable,
  });
  const profile = unwrapEnvelope(profileQuery);
  const billing = unwrapEnvelope(billingQuery);
  const mutations = useProfileMutations();

  const refreshBilling = useCallback(() => {
    void utils.aiBilling.getSummary.invalidate();
    void utils.aiBilling.listPurchases.invalidate();
  }, [utils]);

  if (profile.status === "pending") {
    return <ProfileSkeleton />;
  }

  if (profile.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <SectionError
          title={t("queryErrorTitle")}
          code={profile.code}
          onRetry={() => void profileQuery.refetch()}
        />
      </div>
    );
  }

  const monthUsage =
    billing.status === "success"
      ? billing.data.monthUsage
      : billing.status === "error"
        ? null
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {readOnly ? <ProfileNotice>{t("readOnlyNotice")}</ProfileNotice> : null}

      <ProfileIdentityHeader profile={profile.data} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[12rem_minmax(0,40rem)] lg:items-start lg:gap-10">
        <ProfileSectionNav className="lg:sticky lg:top-24" />

        <div className="flex max-w-[40rem] flex-col gap-6">
          <ProfileAccountCard
            profile={profile.data}
            disabled={readOnly}
            saving={mutations.savingIdentity}
            onSubmit={mutations.updateIdentity}
          />
          <ProfileSecurityCard
            profile={profile.data}
            disabled={readOnly}
            savingPassword={mutations.savingPassword}
            signingOutEverywhere={mutations.signingOutEverywhere}
            onSetPassword={mutations.setPassword}
            onSignOutEverywhere={mutations.signOutEverywhere}
          />
          <ProfileDevicesCard
            devices={profile.data.devices}
            disabled={readOnly}
            removingDeviceId={mutations.removingDeviceId}
            onRemove={(deviceId) => void mutations.removeDevice(deviceId)}
          />
          <ProfileAssistantCard
            defaultModel={profile.data.agentDefaultModel}
            available={assistantAvailable}
            disabled={readOnly}
            saving={mutations.savingAssistant}
            usage={assistantAvailable ? monthUsage : null}
            onSubmit={mutations.updateAssistantPreferences}
          />
          <ProfileBillingCard
            area={area}
            state={billing}
            available={assistantAvailable}
            disabled={readOnly}
            onRetry={() => void billingQuery.refetch()}
            onPurchaseSettled={refreshBilling}
          />
          <ProfileWorkspaceCard area={area} />
        </div>
      </div>
    </div>
  );
}
