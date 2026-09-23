"use client";

import { FileIcon, FileTextIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";

import { evidenceKindFromUrl } from "~/lib/evidence-kind";

const TILE_CLASS =
  "focus-visible:ring-ring group relative block overflow-hidden rounded-md outline outline-black/10 focus-visible:ring-2 focus-visible:outline-none";

/**
 * One evidence file rendered by its kind: images as thumbnails, videos as a
 * first-frame poster with a play badge, PDFs and anything else as a labelled
 * file tile. Every tile opens the original in a new tab.
 */
export function DisputeEvidenceTile({
  url,
  index,
  linkRef,
}: {
  url: string;
  index: number;
  linkRef?: Ref<HTMLAnchorElement>;
}) {
  const t = useTranslations("admin.disputes.evidence");
  const kind = evidenceKindFromUrl(url);
  const label = t(`itemLabel.${kind}`, { index: index + 1 });

  return (
    <a
      ref={linkRef}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={TILE_CLASS}
    >
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- evidence lives on arbitrary external hosts, outside the image loader.
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] motion-reduce:transition-none"
        />
      ) : null}

      {kind === "video" ? (
        <>
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            className="bg-ink aspect-square w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="bg-background/85 absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full shadow-sm"
          >
            <PlayIcon className="size-4" />
          </span>
        </>
      ) : null}

      {kind === "pdf" || kind === "other" ? (
        <span className="bg-muted text-muted-foreground group-hover:text-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-center">
          {kind === "pdf" ? (
            <FileTextIcon aria-hidden="true" className="size-6" />
          ) : (
            <FileIcon aria-hidden="true" className="size-6" />
          )}
          <span className="text-xs font-medium">{t(`kind.${kind}`)}</span>
        </span>
      ) : null}
    </a>
  );
}
