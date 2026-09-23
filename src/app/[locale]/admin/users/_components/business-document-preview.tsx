"use client";

import { FileIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BusinessDocumentItem } from "./users.types";

type DocumentKind = "image" | "pdf" | "file";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

/** The stored URL is the only signal: its path extension decides the preview. */
export function documentKind(fileUrl: string): DocumentKind {
  let pathname = fileUrl;

  try {
    pathname = new URL(fileUrl).pathname;
  } catch {
    // Relative or malformed URLs fall back to the raw string.
  }

  const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  return extension === "pdf" ? "pdf" : "file";
}

/**
 * Thumbnail for image documents; PDFs and other files get a typed tile so
 * the admin knows what opens before clicking.
 */
export function BusinessDocumentPreview({
  document,
  label,
}: {
  document: BusinessDocumentItem;
  label: string;
}) {
  const t = useTranslations("admin.users.documents");
  const kind = documentKind(document.fileUrl);

  return (
    <a
      href={document.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("open", { name: label })}
      className="focus-visible:ring-ring group bg-canvas-soft flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md outline outline-black/10 focus-visible:ring-2 focus-visible:outline-none"
    >
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- documents live on arbitrary storage hosts, outside the image loader.
        <img
          src={document.fileUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      ) : (
        <span className="text-muted-foreground flex flex-col items-center gap-0.5">
          {kind === "pdf" ? (
            <FileTextIcon aria-hidden="true" className="size-5" />
          ) : (
            <FileIcon aria-hidden="true" className="size-5" />
          )}
          <span className="font-mono text-[10px] font-medium uppercase">
            {t(`kind.${kind}`)}
          </span>
        </span>
      )}
    </a>
  );
}
