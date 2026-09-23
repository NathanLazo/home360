import type { UserRole } from "@generated/prisma";

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
    // on first paint and under reduced transparency / more contrast.
    <header className="sticky top-0 z-30 px-2 pt-2 sm:px-3">
      <GlassSurface
        radius="lg"
        className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:pr-2"
      >
        <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-4"
        />
        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
          <BranchSelector branches={branches} />
        </div>
        <LocaleSwitcher />
        <UserMenu {...user} variant="light" />
      </GlassSurface>
    </header>
  );
}
