import type { UserRole } from "@generated/prisma";

import { DashboardRangeSelect } from "./dashboard-range-select";
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
  const filters = (
    <>
      <DashboardRangeSelect />
      <BranchSelector branches={branches} className="flex-1 sm:flex-none" />
    </>
  );

  return (
    <>
      {/* Floating Liquid Glass toolbar: content scrolls under it. Solid canvas
          on first paint and under reduced transparency / more contrast. The pill
          stays a single row; on mobile the filters drop below it, outside the
          sticky bar (display:none keeps the inactive copy out of layout and
          the a11y tree). */}
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
          <div className="ml-auto hidden gap-2 sm:flex">{filters}</div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <NotificationsBell />
            <LocaleSwitcher />
            <UserMenu {...user} variant="light" />
          </div>
        </GlassSurface>
      </header>
      <div className="flex gap-2 px-2 pt-2 empty:hidden sm:hidden">
        {filters}
      </div>
    </>
  );
}
