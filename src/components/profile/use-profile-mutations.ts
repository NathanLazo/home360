"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { MutationOutcome } from "./profile.types";
import type {
  SetPasswordInput,
  UpdateAssistantPreferencesInput,
  UpdateIdentityInput,
} from "~/schemas/profile/profile.schema";
import { api } from "~/trpc/react";

/**
 * Every profile write: toast in the past tense, invalidate `profile.get` and
 * refresh the server shell (the header avatar and name are server-rendered).
 */
export function useProfileMutations() {
  const t = useTranslations("profile");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const router = useRouter();

  const identityMutation = api.profile.updateIdentity.useMutation();
  const assistantMutation =
    api.profile.updateAssistantPreferences.useMutation();
  const passwordMutation = api.profile.setPassword.useMutation();
  const signOutMutation = api.profile.signOutEverywhere.useMutation();
  const removeDeviceMutation = api.profile.removeDevice.useMutation();

  function reportError(
    code: string | null,
    override?: string,
  ): MutationOutcome {
    toast.error(
      code === null ? t("feedback.transportError") : (override ?? errors(code)),
    );
    return { ok: false, code };
  }

  async function refreshProfile() {
    await utils.profile.get.invalidate();
    router.refresh();
  }

  async function updateIdentity(
    input: UpdateIdentityInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await identityMutation.mutateAsync(input);
      if (response.error !== null) return reportError(response.error);
      toast.success(t("feedback.identityUpdated"));
      await refreshProfile();
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  async function updateAssistantPreferences(
    input: UpdateAssistantPreferencesInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await assistantMutation.mutateAsync(input);
      if (response.error !== null) return reportError(response.error);
      toast.success(t("feedback.assistantUpdated"));
      await utils.profile.get.invalidate();
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  /**
   * The server rotates `sessionsValidFrom` on success, so the caller signs
   * out instead of invalidating any cache. The wrong-password case is left
   * to the form (it clears the fields and focuses the current password).
   */
  async function setPassword(
    input: SetPasswordInput,
  ): Promise<MutationOutcome> {
    try {
      const response = await passwordMutation.mutateAsync(input);
      if (response.error !== null) {
        return reportError(
          response.error,
          response.error === "CURRENT_PASSWORD_INVALID"
            ? t("security.password.currentInvalid")
            : undefined,
        );
      }
      toast.success(
        input.currentPassword === null
          ? t("feedback.passwordCreated")
          : t("feedback.passwordUpdated"),
      );
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  async function signOutEverywhere(): Promise<MutationOutcome> {
    try {
      const response = await signOutMutation.mutateAsync();
      if (response.error !== null) return reportError(response.error);
      toast.success(t("feedback.sessionsRevoked"));
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  async function removeDevice(deviceId: string): Promise<MutationOutcome> {
    try {
      const response = await removeDeviceMutation.mutateAsync({ deviceId });
      if (response.error !== null) return reportError(response.error);
      toast.success(t("feedback.deviceRemoved"));
      await utils.profile.get.invalidate();
      return { ok: true, code: null };
    } catch {
      return reportError(null);
    }
  }

  return {
    updateIdentity,
    updateAssistantPreferences,
    setPassword,
    signOutEverywhere,
    removeDevice,
    savingIdentity: identityMutation.isPending,
    savingAssistant: assistantMutation.isPending,
    savingPassword: passwordMutation.isPending,
    signingOutEverywhere: signOutMutation.isPending,
    removingDeviceId: removeDeviceMutation.isPending
      ? removeDeviceMutation.variables.deviceId
      : null,
  };
}
