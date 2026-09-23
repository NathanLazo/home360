"use client";

import { ImageOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RadarRequestDetail } from "./order.types";

type EvidenceItem = RadarRequestDetail["evidence"][number];

/** Request media pathnames embed their kind as the second segment (M0-W3). */
function isVideo(item: EvidenceItem): boolean {
  return item.pathname.split("/")[1] === "requestVideo";
}

const TILE_CLASS =
  "bg-canvas-soft focus-visible:ring-ring block overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

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
        const label = t(isVideo(item) ? "videoLabel" : "photoLabel", {
          number: index + 1,
        });

        return (
          <li key={item.pathname}>
            {isVideo(item) ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                aria-label={label}
                className="bg-canvas-soft aspect-square w-full rounded-md border object-cover"
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
          </li>
        );
      })}
    </ul>
  );
}
