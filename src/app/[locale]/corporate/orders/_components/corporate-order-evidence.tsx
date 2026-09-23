"use client";

import { useTranslations } from "next-intl";

import type { CorporateOrderDetail } from "./corporate-requests.types";

export type CorporateOrderEvidenceProps = {
  evidence: CorporateOrderDetail["evidence"];
  recording: CorporateOrderDetail["recording"];
};

function EvidenceGrid({
  label,
  items,
}: {
  label: string;
  items: CorporateOrderDetail["evidence"]["before"];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground text-xs">{label}</figcaption>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item, index) => (
          <li key={item.pathname}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring block overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* Signed, short-lived private blob URLs: outside the image loader. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={`${label} ${index + 1}`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            </a>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Before/after photos, work notes, materials and recording availability. */
export function CorporateOrderEvidence({
  evidence,
  recording,
}: CorporateOrderEvidenceProps) {
  const t = useTranslations("corporate.orders.detail.evidence");
  const hasPhotos = evidence.before.length > 0 || evidence.after.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasPhotos ? (
        <>
          <EvidenceGrid label={t("before")} items={evidence.before} />
          <EvidenceGrid label={t("after")} items={evidence.after} />
        </>
      ) : (
        <p className="text-muted-foreground text-copy-sm">{t("noPhotos")}</p>
      )}
      {evidence.workNotes ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{t("notes")}</span>
          <p className="text-copy-sm text-pretty whitespace-pre-line">
            {evidence.workNotes}
          </p>
        </div>
      ) : null}
      {evidence.materials.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t("materials")}
          </span>
          <ul className="text-copy-sm flex flex-col gap-0.5">
            {evidence.materials.map((material) => (
              <li key={material.id}>
                {t("materialLine", {
                  quantity: material.quantity,
                  name: material.name,
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-copy-sm">
        {recording.available
          ? recording.complete
            ? t("recordingComplete")
            : t("recordingIncomplete")
          : t("recordingMissing")}
      </p>
    </div>
  );
}
