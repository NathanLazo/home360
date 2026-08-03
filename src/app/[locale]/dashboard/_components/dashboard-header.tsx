import type { ReactNode } from "react";
import type { UserRole } from "../../../../../generated/prisma";

import { BranchSelector } from "~/components/branch-selector";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { UserMenu } from "~/components/user-menu";

export type DashboardHeaderProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  branches: Array<{ id: string; name: string }>;
  mobileNavigation: ReactNode;
};

export function DashboardHeader({
  user,
  branches,
  mobileNavigation,
}: DashboardHeaderProps) {
  return (
    <header className="bg-background flex min-h-16 flex-wrap items-center gap-2 border-b px-4 py-2 sm:flex-nowrap sm:px-6">
      {mobileNavigation}
      <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
        <BranchSelector branches={branches} />
      </div>
      <LocaleSwitcher />
      <UserMenu {...user} variant="light" />
    </header>
  );
}
