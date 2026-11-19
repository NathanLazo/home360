import { ImageOffIcon, VideoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  isVideoEvidence,
  type RequestEvidenceItem,
} from "./request-evidence.utils";

/**
 * First piece of customer media as a row thumbnail, with the total count so
 * requests with several photos read apart at a glance.
 */
export function RequestThumbnail({
  evidence,
}: {
  evidence: RequestEvidenceItem[];
}) {
  const t = useTranslations("dashboard.requests");
  const first = evidence[0];
  const count = evidence.length;

  return (
    <div className="relative size-12 shrink-0">
      <div className="bg-canvas-soft text-muted-foreground flex size-full items-center justify-center overflow-hidden rounded-lg border">
        {!first ? (
          <ImageOffIcon aria-hidden="true" className="size-4" />
        ) : isVideoEvidence(first) ? (
          <VideoIcon aria-hidden="true" className="size-4" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- signed Blob URLs expire in minutes, outside the image loader.
          <img
            src={first.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        )}
      </div>
      {count > 0 ? (
        <span
          className="bg-foreground text-background ring-background absolute -right-1.5 -bottom-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] leading-none font-medium tabular-nums ring-2"
          aria-label={t("mediaCount", { count })}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}
