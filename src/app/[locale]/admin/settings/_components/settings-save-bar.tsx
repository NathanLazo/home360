"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { GlassDock } from "~/components/glass";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Sticky save bar: the settings screen's glass + metal signature. The dock
 * floats over the form while it scrolls; its save action wears the live
 * metal ring only once there is something to save (`Button` drops the ring
 * while disabled). It stays live while saving so the button is never
 * remounted under the pointer.
 */
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
    <GlassDock
      shape="panel"
      className="sticky bottom-4 z-10 flex-wrap"
      action={
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
            metal={dirty ? "live" : "static"}
            className="min-h-11 aria-disabled:cursor-progress sm:min-h-10"
            // While saving the button stays enabled-but-inert instead of
            // `disabled`, which would drop the live ring and remount it.
            disabled={!dirty}
            aria-disabled={saving || undefined}
            aria-busy={saving}
            onClick={(event) => {
              if (saving) {
                event.preventDefault();
              }
            }}
          >
            {saving ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      }
    >
      <p
        className="text-muted-foreground flex items-center gap-2 pl-1 text-sm"
        aria-live="polite"
      >
        {/* The dot is a second, static cue next to the text: it fades and
            settles in when the form turns dirty, never the only signal. */}
        <span
          aria-hidden="true"
          className={cn(
            "bg-warning size-2 shrink-0 rounded-full transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-opacity",
            dirty ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
        {dirty ? t("unsaved") : t("upToDate")}
      </p>
    </GlassDock>
  );
}
