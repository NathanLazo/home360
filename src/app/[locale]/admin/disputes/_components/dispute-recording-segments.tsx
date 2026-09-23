"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { DisputeRecordingSegment } from "./disputes.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

type SegmentState = "interrupted" | "open" | "notUploaded" | "ok";

const stateVariants: Record<SegmentState, StatusBadgeVariant> = {
  interrupted: "destructive",
  open: "warning",
  notUploaded: "warning",
  ok: "success",
};

function toState(segment: DisputeRecordingSegment): SegmentState {
  if (segment.interrupted) {
    return "interrupted";
  }

  if (segment.endedAt === null) {
    return "open";
  }

  return segment.uploadedAt === null ? "notUploaded" : "ok";
}

/**
 * The recording is captured in segments (a pause or crash starts a new one).
 * Each segment's window and state is evidence in itself under D6.
 */
export function DisputeRecordingSegments({
  segments,
}: {
  segments: DisputeRecordingSegment[];
}) {
  const t = useTranslations("admin.disputes.recording.segments");
  const formatter = useFormatter();

  if (segments.length === 0) {
    return <p className="text-muted-foreground text-copy-sm">{t("empty")}</p>;
  }

  const time = (date: Date) =>
    formatter.dateTime(date, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <ol
      className="flex flex-col divide-y rounded-xl border"
      aria-label={t("title")}
    >
      {segments.map((segment, index) => {
        const state = toState(segment);
        const durationSec =
          segment.endedAt === null
            ? null
            : Math.max(
                0,
                Math.round(
                  (segment.endedAt.getTime() - segment.startedAt.getTime()) /
                    1000,
                ),
              );

        return (
          <li
            key={segment.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-copy-sm font-medium">
                {t("label", { index: index + 1 })}
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {segment.endedAt === null
                  ? t("rangeOpen", { start: time(segment.startedAt) })
                  : t("range", {
                      start: time(segment.startedAt),
                      end: time(segment.endedAt),
                      minutes: Math.floor((durationSec ?? 0) / 60),
                      seconds: (durationSec ?? 0) % 60,
                    })}
              </span>
            </div>
            <StatusBadge
              status={state}
              variantMap={stateVariants}
              label={t(`state.${state}`)}
            />
          </li>
        );
      })}
    </ol>
  );
}
