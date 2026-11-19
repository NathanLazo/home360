"use client";

import { ImageOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { isVideoEvidence } from "./request-evidence.utils";
import type { RadarRequestDetail } from "./request.types";

type EvidenceItem = RadarRequestDetail["evidence"][number];

const TILE_CLASS =
  "bg-canvas-soft focus-visible:ring-ring block overflow-hidden rounded-xl border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

/** Customer photos/videos of the request, served through signed URLs. */
export function RequestEvidenceGrid({
  evidence,
}: {
  evidence: EvidenceItem[];
}) {
  const t = useTranslations("dashboard.requests.detail");

  if (evidence.length === 0) {
    return (
      <p className="text-muted-foreground text-copy-sm inline-flex items-center gap-2">
        <ImageOffIcon aria-hidden="true" className="size-4" />
        {t("noEvidence")}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {evidence.map((item, index) => {
        const label = t(isVideoEvidence(item) ? "videoLabel" : "photoLabel", {
          number: index + 1,
        });

        return (
          <li key={item.pathname} className="relative">
            {isVideoEvidence(item) ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                aria-label={label}
                className="bg-canvas-soft aspect-square w-full rounded-xl border object-cover"
              />
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={TILE_CLASS}
                aria-label={t("openMedia", { label })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Blob URLs expire in minutes, outside the image loader. */}
                <img
                  src={item.url}
                  alt={label}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </a>
            )}
            <span
              aria-hidden="true"
              className="bg-background/85 text-foreground pointer-events-none absolute top-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 font-mono text-xs font-medium tabular-nums backdrop-blur-sm"
            >
              {index + 1}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
