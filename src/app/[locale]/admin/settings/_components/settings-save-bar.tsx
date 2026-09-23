"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { MetalRing } from "~/components/metal";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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

  const saveButton = (
    <Button
      type="submit"
      className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
      disabled={!dirty || saving}
      aria-busy={saving}
    >
      {saving ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {saving ? t("saving") : t("save")}
    </Button>
  );

  return (
    <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t py-4 backdrop-blur">
      <p
        className="text-muted-foreground flex items-center gap-2 text-sm"
        aria-live="polite"
      >
        {/* The dot is a second, static cue next to the text: it fades and
            settles in when the form turns dirty, never the only signal. */}
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full bg-amber-500 transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-opacity",
            dirty ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
        {dirty ? t("unsaved") : t("upToDate")}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
          disabled={!dirty || saving}
          onClick={onReset}
        >
          {t("discard")}
        </Button>
        {/* Metal appears only once there is something to save; it stays on
            while saving so the button is not remounted under the pointer. */}
        {dirty ? (
          <MetalRing strength={0.55}>{saveButton}</MetalRing>
        ) : (
          saveButton
        )}
      </div>
    </div>
  );
}
