"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { AppSidebar, type SidebarItem } from "~/components/app-sidebar";
import { SidebarPlanChip } from "~/components/sidebar-plan-chip";
import { usePathname } from "~/i18n/navigation";
import { DASHBOARD_NAV, type DashboardNavKey } from "~/lib/dashboard-nav";
import { api } from "~/trpc/react";

export type DashboardSidebarProps = {
  labels: Record<DashboardNavKey, string>;
  activeOrdersCount: number;
  brandLabel: string;
  mobileTitle: string;
  mobileDescription: string;
  user: {
    name: string;
    subtitle: string;
    seed: string;
    image: string | null;
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
  const t = useTranslations("dashboard.sidebar");
  // Same query the subscription and payments screens use, so the chip reads
  // from the shared cache. No subscription (or a failed read) shows no chip.
  const subscriptionQuery = api.subscription.getCurrent.useQuery();
  const planName =
    subscriptionQuery.data?.error === null
      ? (subscriptionQuery.data.result?.plan.name ?? null)
      : null;
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
      footerSlot={
        planName ? (
          <SidebarPlanChip
            label={planName}
            ariaLabel={t("planLink", { plan: planName })}
            href="/dashboard/subscription"
          />
        ) : null
      }
    />
  );
}
