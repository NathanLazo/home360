"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { SaveAdminSettingsInput } from "./settings.schema";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

export type SettingsMutations = {
  save: (input: SaveAdminSettingsInput) => void;
  saving: boolean;
};

export function useSettingsMutations(options?: {
  onSaved?: () => void;
}): SettingsMutations {
  const t = useTranslations("admin.settings.toasts");
  const errorsT = useTranslations("errors");
  const utils = api.useUtils();

  const mutation = api.admin.settings.save.useMutation({
    onSuccess: async (response) => {
      if (response.error !== null) {
        toast.error(errorsT(response.error));

        // A stale write means another admin already saved: refetching is the
        // only safe way back, never a silent overwrite.
        if (response.error === "SETTINGS_STALE") {
          await utils.admin.settings.get.invalidate();
        }

        return;
      }

      toast.success(t("saved"));
      await Promise.all([
        utils.admin.settings.get.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      options?.onSaved?.();
    },
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });

  return {
    save: (input) => mutation.mutate(input),
    saving: mutation.isPending,
  };
}
