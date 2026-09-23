"use client";

import { useTranslations } from "next-intl";

export type SkipLinkProps = {
  /** `id` of the shell's `<main>` element. */
  targetId: string;
};

/**
 * First focusable element of an app shell: lets keyboard and switch users
 * jump past the sidebar and header straight to the page content. Hidden above
 * the viewport until it receives keyboard focus.
 */
export function SkipLink({ targetId }: SkipLinkProps) {
  const t = useTranslations("common.a11y");

  return (
    <a
      href={`#${targetId}`}
      className="bg-background text-foreground focus-visible:ring-ring ease-ui fixed top-2 left-2 z-[60] -translate-y-16 rounded-md px-3 py-2 text-sm font-medium shadow-md transition-transform duration-150 focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
    >
      {t("skipToContent")}
    </a>
  );
}
