import type { UserRole } from "@generated/prisma";

import { NotificationsBell } from "./notifications-bell";
import {
  AppShellBreadcrumb,
  AppShellHeader,
  type AppShellBreadcrumbProps,
} from "~/components/app-shell";
import { BranchSelector } from "~/components/branch-selector";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { UserMenu } from "~/components/user-menu";

export type DashboardHeaderProps = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: UserRole;
  };
  branches: Array<{ id: string; name: string }>;
  toggleSidebarLabel: string;
  breadcrumb: AppShellBreadcrumbProps;
};

/**
 * Business panel top row: "Business › Section" plus the branch filter, the
 * bell and the user menu. The theme toggle and language switch live in the
 * panel footer on desktop and only surface here on mobile, where there is no
 * footer.
 */
export function DashboardHeader({
  user,
  branches,
  toggleSidebarLabel,
  breadcrumb,
}: DashboardHeaderProps) {
  return (
    <AppShellHeader
      toggleSidebarLabel={toggleSidebarLabel}
      actions={
        <>
          <BranchSelector
            branches={branches}
            size="sm"
            className="w-auto max-w-36 sm:max-w-none sm:min-w-48"
          />
          <NotificationsBell />
          <span className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <LocaleSwitcher />
          </span>
          <UserMenu {...user} variant="light" />
        </>
      }
    >
      <AppShellBreadcrumb {...breadcrumb} />
    </AppShellHeader>
  );
}
