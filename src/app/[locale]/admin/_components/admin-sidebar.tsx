"use client";

import { adminNav } from "./admin-nav";
import { AppSidebar, type SidebarItem } from "~/components/app-sidebar";

export type AdminSidebarProps = {
  labels: Record<string, string>;
  openDisputes: number;
  brandLabel: string;
  mobileTitle: string;
  mobileDescription: string;
  user: {
    name: string;
    initials: string;
  };
};

export function AdminSidebar({
  labels,
  openDisputes,
  brandLabel,
  mobileTitle,
  mobileDescription,
  user,
}: AdminSidebarProps) {
  const items: SidebarItem[] = adminNav.map(({ labelKey, ...item }) => {
    void labelKey;

    return {
      ...item,
      label: labels[item.key] ?? item.key,
      badgeCount:
        item.key === "disputes" && openDisputes > 0 ? openDisputes : undefined,
    };
  });

  return (
    <AppSidebar
      variant="dark"
      items={items}
      homeHref="/admin"
      brandLabel={brandLabel}
      mobileTitle={mobileTitle}
      mobileDescription={mobileDescription}
      user={user}
    />
  );
}
