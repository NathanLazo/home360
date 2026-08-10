"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  ChangePasswordInput,
  UpdateBusinessProfileInput,
  UpdateOwnerInput,
} from "./settings.schema";
import { api } from "~/trpc/react";

/** `code` is `null` on success and on a transport failure with no server code. */
export type MutationOutcome = { ok: boolean; code: string | null };

export function useSettingsMutations() {
  const t = useTranslations("dashboard.settings");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const profileMutation =
    api.businessSettings.updateBusinessProfile.useMutation();
  const ownerMutation = api.businessSettings.updateOwner.useMutation();
  const passwordMutation = api.businessSettings.changePassword.useMutation();

  function reportError(
    code: string | null,
    override?: string,
  ): MutationOutcome {
    toast.error(
      code === null ? t("feedback.transportError") : (override ?? errors(code)),
    );
    return { ok: false, code };
  }

  async function updateBusinessProfile(
    input: UpdateBusinessProfileInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await profileMutation.mutateAsync(input);
      if (response.error !== null) {
        return reportError(
          response.error,
          response.error === "BUSINESS_NOT_ACTIVE"
            ? t("profile.notActiveNotice")
            : undefined,
        );
      }
      toast.success(t("feedback.profileUpdated"));
      await utils.businessSettings.get.invalidate();
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  async function updateOwner(
    input: UpdateOwnerInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await ownerMutation.mutateAsync(input);
      if (response.error !== null) return reportError(response.error);
      toast.success(t("feedback.ownerUpdated"));
      await utils.businessSettings.get.invalidate();
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  /**
   * On success the server rotates `sessionsValidFrom`, so the caller signs the
   * owner out instead of invalidating any cache.
   */
  async function changePassword(
    input: ChangePasswordInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await passwordMutation.mutateAsync(input);
      if (response.error !== null) {
        return reportError(
          response.error,
          response.error === "CURRENT_PASSWORD_INVALID"
            ? t("password.currentInvalid")
            : undefined,
        );
      }
      toast.success(t("feedback.passwordUpdated"));
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  return {
    updateBusinessProfile,
    updateOwner,
    changePassword,
    savingProfile: profileMutation.isPending,
    savingOwner: ownerMutation.isPending,
    savingPassword: passwordMutation.isPending,
  };
}
