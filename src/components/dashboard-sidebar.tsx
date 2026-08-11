"use client";

import { useSearchParams } from "next/navigation";

import { AppSidebar, type SidebarItem } from "~/components/app-sidebar";
import { usePathname } from "~/i18n/navigation";
import { DASHBOARD_NAV, type DashboardNavKey } from "~/lib/dashboard-nav";

export type DashboardSidebarProps = {
  labels: Record<DashboardNavKey, string>;
  activeOrdersCount: number;
  brandLabel: string;
  mobileTitle: string;
  mobileDescription: string;
  user: {
    name: string;
    subtitle: string;
    initials: string;
  };
};

function isCurrentSection(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({
  labels,
  activeOrdersCount,
  brandLabel,
  mobileTitle,
  mobileDescription,
  user,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items: SidebarItem[] = DASHBOARD_NAV.map((item) => {
    const nextSearchParams = isCurrentSection(pathname, item.href)
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams();
    const branchId = searchParams.get("branch");

    if (branchId) {
      nextSearchParams.set("branch", branchId);
    }

    const query = nextSearchParams.toString();
    const href = query ? `${item.href}?${query}` : item.href;

    return {
      ...item,
      href,
      label: labels[item.key],
      badgeCount: item.key === "orders" ? activeOrdersCount : undefined,
    };
  });

  return (
    <AppSidebar
      variant="light"
      items={items}
      homeHref="/dashboard"
      brandLabel={brandLabel}
      mobileTitle={mobileTitle}
      mobileDescription={mobileDescription}
      user={user}
    />
  );
}
