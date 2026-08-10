"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

const VISIBLE_LIMIT = 4;

export function DisputeEvidenceGrid({ urls }: { urls: string[] }) {
  const t = useTranslations("admin.disputes.evidence");
  const [expanded, setExpanded] = useState(false);

  if (urls.length === 0) {
    return null;
  }

  const visible = expanded ? urls : urls.slice(0, VISIBLE_LIMIT);
  const hidden = urls.length - visible.length;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t("title")}
      </h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visible.map((url, index) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-visible:ring-ring block overflow-hidden rounded-lg outline outline-black/10 focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- evidence
                  lives on arbitrary external hosts, outside the image loader. */}
              <img
                src={url}
                alt={t("itemAlt", { index: index + 1 })}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-150 ease-out hover:scale-[1.02]"
              />
            </a>
          </li>
        ))}
        {hidden > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring flex aspect-square w-full items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none"
            >
              {t("more", { count: hidden })}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
