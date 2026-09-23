"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

/**
 * D6: the service recording is mandatory and uninterrupted, and its absence
 * resolves the dispute in the customer's favour. That makes it the single most
 * decisive piece of the file, so it is rendered first and, when missing, as a
 * prominent alert rather than a neutral empty state.
 */
export function DisputeRecordingPlayer({
  recordingUrl,
  recordingComplete,
}: {
  recordingUrl: string | null;
  recordingComplete: boolean;
}) {
  const t = useTranslations("admin.disputes.recording");
  const [durationSec, setDurationSec] = useState<number | null>(null);

  if (recordingUrl === null || !recordingComplete) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle>
          {recordingUrl === null ? t("missingTitle") : t("incompleteTitle")}
        </AlertTitle>
        <AlertDescription>{t("ruleDescription")}</AlertDescription>
      </Alert>
    );
  }

  const minutes = durationSec === null ? null : Math.floor(durationSec / 60);
  const seconds = durationSec === null ? null : Math.round(durationSec % 60);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
        {t("title")}
      </h3>
      {/* A user-generated service recording has no caption track available. */}
      <video
        controls
        preload="metadata"
        src={recordingUrl}
        className="bg-ink w-full rounded-lg outline outline-black/10"
        onLoadedMetadata={(event) =>
          setDurationSec(event.currentTarget.duration)
        }
      />
      {minutes !== null && seconds !== null ? (
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {t("duration", { minutes, seconds })}
        </p>
      ) : null}
    </section>
  );
}
