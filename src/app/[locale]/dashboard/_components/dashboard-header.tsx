import type { UserRole } from "@generated/prisma";

import { NotificationsBell } from "./notifications-bell";
import { BranchSelector } from "~/components/branch-selector";
import { GlassSurface } from "~/components/glass";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
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
};

export function DashboardHeader({
  user,
  branches,
  toggleSidebarLabel,
}: DashboardHeaderProps) {
  return (
    // Floating Liquid Glass toolbar: content scrolls under it. Solid canvas
    // on first paint and under reduced transparency / more contrast. Always a
    // single row: the branch filter flexes to fill the space on mobile.
    <header className="sticky top-0 z-30 px-2 pt-2 sm:px-3">
      <GlassSurface
        radius="pill"
        className="flex min-h-12 items-center gap-2 px-3 py-1.5 pr-1.5"
      >
        <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-4"
        />
        <BranchSelector
          branches={branches}
          className="flex-1 sm:ml-auto sm:flex-none"
        />
        <NotificationsBell />
        <LocaleSwitcher />
        <UserMenu {...user} variant="light" />
      </GlassSurface>
    </header>
  );
}
