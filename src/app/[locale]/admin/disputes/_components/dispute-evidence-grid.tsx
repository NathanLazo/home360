"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  ADMIN_DURATION,
  ADMIN_EASE_OUT,
  ADMIN_STAGGER_S,
  PRESS_CONTROL_CLASS,
} from "../../_components/admin-motion";
import { cn } from "~/lib/utils";

const VISIBLE_LIMIT = 4;

export function DisputeEvidenceGrid({ urls }: { urls: string[] }) {
  const t = useTranslations("admin.disputes.evidence");
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const firstRevealedRef = useRef<HTMLAnchorElement>(null);

  // The "+N" button unmounts on click; focus moves to the first revealed
  // tile so keyboard users keep their place.
  useEffect(() => {
    if (expanded) {
      firstRevealedRef.current?.focus();
    }
  }, [expanded]);

  if (urls.length === 0) {
    return null;
  }

  const visible = expanded ? urls : urls.slice(0, VISIBLE_LIMIT);
  const hidden = urls.length - visible.length;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
        {t("title")}
      </h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visible.map((url, index) => {
          // Only the tiles revealed by "+N" enter with motion; the first
          // batch is part of the file and paints statically.
          const revealed = index >= VISIBLE_LIMIT;

          return (
            <motion.li
              key={url}
              initial={
                revealed
                  ? reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "scale(0.96)" }
                  : false
              }
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{
                duration: ADMIN_DURATION.standard,
                ease: ADMIN_EASE_OUT,
                delay: revealed ? (index - VISIBLE_LIMIT) * ADMIN_STAGGER_S : 0,
              }}
            >
              <a
                ref={index === VISIBLE_LIMIT ? firstRevealedRef : undefined}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-visible:ring-ring group block overflow-hidden rounded-md outline outline-black/10 focus-visible:ring-2 focus-visible:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- evidence
                    lives on arbitrary external hosts, outside the image loader. */}
                <img
                  src={url}
                  alt={t("itemAlt", { index: index + 1 })}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              </a>
            </motion.li>
          );
        })}
        {hidden > 0 ? (
          <li>
            <button
              type="button"
              aria-label={t("showAll", { count: urls.length })}
              onClick={() => setExpanded(true)}
              className={cn(
                "bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring hover:bg-canvas-soft-2 flex aspect-square w-full items-center justify-center rounded-md font-mono text-sm font-medium tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                PRESS_CONTROL_CLASS,
              )}
            >
              {t("more", { count: hidden })}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
