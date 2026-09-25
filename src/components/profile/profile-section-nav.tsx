"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { PROFILE_SECTIONS, type ProfileSectionId } from "./profile.types";
import {
  MOTION_DURATION_MS,
  MOTION_EASE,
  prefersReducedMotion,
} from "~/components/motion";
import { cn } from "~/lib/utils";

const SLIDE = {
  duration: MOTION_DURATION_MS.quick / 1000,
  ease: MOTION_EASE.smoothOut,
} as const;
const INSTANT = { duration: 0 } as const;

/** Band of the viewport that decides the current section (below the header). */
const OBSERVER_MARGIN = "-25% 0px -60% 0px";

function isSectionId(value: string): value is ProfileSectionId {
  return (PROFILE_SECTIONS as readonly string[]).includes(value);
}

function sectionFromHash(): ProfileSectionId {
  const hash = window.location.hash.slice(1);
  return isSectionId(hash) ? hash : PROFILE_SECTIONS[0];
}

/**
 * Index of the profile sections. Desktop: sticky column; mobile: a row of
 * chips that scrolls with the next chip peeking. The current section is real
 * state (`aria-current`), observed while scrolling; the highlight slides
 * between items (150 ms) and snaps under reduced motion.
 */
export function ProfileSectionNav({ className }: { className?: string }) {
  const t = useTranslations("profile.nav");
  const reduceMotion = useReducedMotion() === true;
  const [active, setActive] = useState<ProfileSectionId>(PROFILE_SECTIONS[0]);
  const [pinned, setPinned] = useState<ProfileSectionId | null>(null);

  useEffect(() => {
    setActive(sectionFromHash());
  }, []);

  useEffect(() => {
    const targets = PROFILE_SECTIONS.map((id) =>
      document.getElementById(id),
    ).filter((element): element is HTMLElement => element !== null);

    if (targets.length === 0) return;

    const visible = new Map<ProfileSectionId, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (isSectionId(entry.target.id)) {
            visible.set(entry.target.id, entry.isIntersecting);
          }
        }
        const first = PROFILE_SECTIONS.find((id) => visible.get(id));
        if (first) {
          setActive(first);
          // A click pins its target until the scroll reaches it.
          setPinned((current) => (current === first ? null : current));
        }
      },
      { rootMargin: OBSERVER_MARGIN },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
    id: ProfileSectionId,
  ) {
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    setPinned(id);
    setActive(id);
    window.history.replaceState(window.history.state, "", `#${id}`);
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    // Focus follows the scroll so Tab continues inside the section.
    target.focus({ preventScroll: true });
  }

  const current = pinned ?? active;

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        // Mobile: bleed to the content edges so the last chip peeks (16 px gutter).
        "-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0",
        className,
      )}
    >
      <ul className="flex w-max snap-x snap-mandatory gap-1 pe-4 lg:w-auto lg:flex-col lg:pe-0">
        {PROFILE_SECTIONS.map((id) => {
          const isCurrent = current === id;
          return (
            <li key={id} className="relative snap-start">
              {isCurrent ? (
                <motion.span
                  aria-hidden="true"
                  layoutId="profile-section-nav-active"
                  transition={reduceMotion ? INSTANT : SLIDE}
                  className="bg-canvas-soft-2 rounded-pill shadow-hairline absolute inset-0"
                />
              ) : null}
              <a
                href={`#${id}`}
                aria-current={isCurrent ? "location" : undefined}
                onClick={(event) => handleClick(event, id)}
                className={cn(
                  "text-copy-sm rounded-pill focus-visible:ring-ring focus-visible:ring-offset-background relative z-10 flex h-8 items-center px-3 whitespace-nowrap transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none",
                  "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2 pointer-coarse:after:content-['']",
                  isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(id)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
