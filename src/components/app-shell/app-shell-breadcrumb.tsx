"use client";

import { ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  MOTION_DISTANCE_PX,
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "~/components/motion/motion-tokens";
import { Link, usePathname } from "~/i18n/navigation";

export type AppShellBreadcrumbSection = {
  key: string;
  href: string;
  label: string;
};

export type AppShellBreadcrumbProps = {
  /** Root crumb: the workspace (business, account or platform) and its home. */
  root: { label: string; href: string };
  /** Shell sections; the longest matching href is the current crumb. */
  sections: AppShellBreadcrumbSection[];
};

function pathOf(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? href;
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

function matches(pathname: string, href: string): boolean {
  const path = pathOf(href);
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * "Workspace › Section" as the panel's title line. The leaf crossfades on
 * navigation so the eye reads the change as feedback, not as a reload; the
 * root stays put and links home.
 */
export function AppShellBreadcrumb({
  root,
  sections,
}: AppShellBreadcrumbProps) {
  const pathname = usePathname();
  const t = useTranslations("common.shell");
  const reduceMotion = useReducedMotion() === true;
  const rootPath = pathOf(root.href);
  const current = sections
    .filter((section) => pathOf(section.href) !== rootPath)
    .filter((section) => matches(pathname, section.href))
    .sort((a, b) => pathOf(b.href).length - pathOf(a.href).length)[0];
  const transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: MOTION_DURATION_MS.quick / 1000,
        ease: MOTION_EASE.smoothOut,
      };
  const offset = reduceMotion ? 0 : MOTION_DISTANCE_PX.micro;

  return (
    <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] leading-none">
        <li className="flex min-w-0 items-center">
          <Link
            href={root.href}
            aria-current={current ? undefined : "page"}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring aria-[current=page]:text-foreground truncate rounded-xs px-1 py-1 transition-colors duration-150 ease-out outline-none focus-visible:ring-2 aria-[current=page]:font-medium motion-reduce:transition-none"
          >
            {root.label}
          </Link>
        </li>
        <AnimatePresence mode="wait" initial={false}>
          {current ? (
            <motion.li
              key={current.key}
              className="flex min-w-0 items-center gap-1"
              initial={{ opacity: 0, y: offset }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -offset }}
              transition={transition}
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground/60 size-3.5 shrink-0"
              />
              <span
                aria-current="page"
                className="text-foreground truncate px-1 py-1 font-medium tracking-[-0.01em]"
              >
                {current.label}
              </span>
            </motion.li>
          ) : null}
        </AnimatePresence>
      </ol>
    </nav>
  );
}
