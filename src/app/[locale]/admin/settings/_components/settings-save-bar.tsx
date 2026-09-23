"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";

export function SettingsSaveBar({
  dirty,
  saving,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("admin.settings.saveBar");

  return (
    <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t py-4 backdrop-blur">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {dirty ? t("unsaved") : t("upToDate")}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-10"
          disabled={!dirty || saving}
          onClick={onReset}
        >
          {t("discard")}
        </Button>
        <Button
          type="submit"
          className="min-h-11 sm:min-h-10"
          disabled={!dirty || saving}
        >
          {saving ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
