"use client";

import { useSearchParams } from "next/navigation";

import { CORPORATE_NAV, type CorporateNavKey } from "./corporate-nav";
import { AppSidebar, type SidebarItem } from "~/components/app-sidebar";
import {
  SidebarPlanChip,
  type SidebarPlanChipProps,
} from "~/components/sidebar-plan-chip";

export type CorporateSidebarProps = {
  labels: Record<CorporateNavKey, string>;
  brandLabel: string;
  mobileTitle: string;
  mobileDescription: string;
  user: {
    name: string;
    subtitle: string;
    initials: string;
  };
  tierChip: Omit<SidebarPlanChipProps, "href">;
};

/**
 * Corporate navigation over the shared F0 sidebar. The `location` filter is
 * carried across sections (same F2-01 pattern as `branch` in the business
 * dashboard) so a filtered view survives navigation and refresh.
 */
export function CorporateSidebar({
  labels,
  brandLabel,
  mobileTitle,
  mobileDescription,
  user,
  tierChip,
}: CorporateSidebarProps) {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location");
  const items: SidebarItem[] = CORPORATE_NAV.map((item) => {
    const nextSearchParams = new URLSearchParams();

    if (locationId) {
      nextSearchParams.set("location", locationId);
    }

    const query = nextSearchParams.toString();

    return {
      key: item.key,
      icon: item.icon,
      label: labels[item.key],
      href: query ? `${item.href}?${query}` : item.href,
    };
  });

  return (
    <AppSidebar
      variant="light"
      items={items}
      homeHref="/corporate"
      brandLabel={brandLabel}
      mobileTitle={mobileTitle}
      mobileDescription={mobileDescription}
      user={user}
      footerSlot={
        <SidebarPlanChip {...tierChip} href="/corporate/membership" />
      }
    />
  );
}
