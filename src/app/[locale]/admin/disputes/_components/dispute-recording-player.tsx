"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DisputeRecordingSegments } from "./dispute-recording-segments";
import type { DisputeRecordingSegment } from "./disputes.types";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

/**
 * D6: the service recording is mandatory and uninterrupted, and its absence
 * resolves the dispute in the customer's favour. That makes it the single most
 * decisive piece of the file, so it is rendered first. A missing recording is
 * a prominent alert; an incomplete one still plays (whatever was captured is
 * evidence) under a warning, followed by the segment timeline.
 */
export function DisputeRecordingPlayer({
  recordingUrl,
  recordingComplete,
  segments,
}: {
  recordingUrl: string | null;
  recordingComplete: boolean;
  segments: DisputeRecordingSegment[];
}) {
  const t = useTranslations("admin.disputes.recording");
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const minutes = durationSec === null ? null : Math.floor(durationSec / 60);
  const seconds = durationSec === null ? null : Math.round(durationSec % 60);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
        {t("title")}
      </h3>

      {recordingUrl === null ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("missingTitle")}</AlertTitle>
          <AlertDescription>{t("ruleDescription")}</AlertDescription>
        </Alert>
      ) : (
        <>
          {!recordingComplete ? (
            <Alert variant="warning">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertTitle>{t("incompleteTitle")}</AlertTitle>
              <AlertDescription>
                {t("partialDescription")} {t("ruleDescription")}
              </AlertDescription>
            </Alert>
          ) : null}
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
          {minutes !== null && seconds !== null && Number.isFinite(minutes) ? (
            <p className="text-muted-foreground font-mono text-xs tabular-nums">
              {t("duration", { minutes, seconds })}
            </p>
          ) : null}
        </>
      )}

      <h4 className="text-muted-foreground mt-2 text-xs font-medium">
        {t("segments.title")}
      </h4>
      <DisputeRecordingSegments segments={segments} />
    </section>
  );
}
