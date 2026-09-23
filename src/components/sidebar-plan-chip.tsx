import { Link } from "~/i18n/navigation";

export type SidebarPlanChipProps = {
  /** Visible plan or tier name (already localized). */
  label: string;
  /** Accessible name, e.g. "Plan Estándar, ver suscripción". */
  ariaLabel: string;
  href: string;
};

/**
 * The account's plan as a quiet static-chrome chip (`bg-metal`) in the
 * sidebar footer. Static on purpose: it is present on every screen, so it
 * leaves the live-metal budget (≤ 1–2 per screen) to each screen's primary
 * action. Hidden when the sidebar collapses to icons.
 */
export function SidebarPlanChip({
  label,
  ariaLabel,
  href,
}: SidebarPlanChipProps) {
  return (
    <div className="px-2 group-data-[collapsible=icon]:hidden">
      <Link
        href={href}
        aria-label={ariaLabel}
        className="bg-metal text-ink shadow-hairline focus-visible:ring-ring focus-visible:ring-offset-sidebar inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium tracking-tight whitespace-nowrap transition-[box-shadow,opacity] duration-150 ease-out outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        {label}
      </Link>
    </div>
  );
}
