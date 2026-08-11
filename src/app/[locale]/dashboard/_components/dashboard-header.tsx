import type { UserRole } from "../../../../../generated/prisma";

import { BranchSelector } from "~/components/branch-selector";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { UserMenu } from "~/components/user-menu";

export type DashboardHeaderProps = {
  user: {
    name: string;
    email: string;
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
    <header className="bg-background sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b px-4 py-2 sm:flex-nowrap sm:px-6">
      <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1.5" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
        <BranchSelector branches={branches} />
      </div>
      <LocaleSwitcher />
      <UserMenu {...user} variant="light" />
    </header>
  );
}
