"use client";

import { MetalRing } from "~/components/metal";
import { Link } from "~/i18n/navigation";

export type SidebarPlanChipProps = {
  /** Visible plan or tier name (already localized). */
  label: string;
  /** Accessible name, e.g. "Plan Estándar, ver suscripción". */
  ariaLabel: string;
  href: string;
};

/**
 * The account's plan as a quiet metal chip in the sidebar footer. It is the
 * shell's only metal instance, so each screen keeps room for one primary
 * action ring. Hidden when the sidebar collapses to icons.
 */
export function SidebarPlanChip({
  label,
  ariaLabel,
  href,
}: SidebarPlanChipProps) {
  return (
    <div className="px-2 group-data-[collapsible=icon]:hidden">
      <MetalRing strength={0.5} disableGlow>
        <Link
          href={href}
          aria-label={ariaLabel}
          className="bg-background text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium tracking-tight whitespace-nowrap transition-[background-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px]"
        >
          {label}
        </Link>
      </MetalRing>
    </div>
  );
}
