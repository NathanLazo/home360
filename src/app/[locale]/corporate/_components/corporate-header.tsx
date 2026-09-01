import type { UserRole } from "@generated/prisma";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { UserMenu } from "~/components/user-menu";

export type CorporateHeaderProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  toggleSidebarLabel: string;
};

export function CorporateHeader({
  user,
  toggleSidebarLabel,
}: CorporateHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b px-4 py-2 sm:px-6">
      <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1.5" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <UserMenu {...user} variant="light" />
      </div>
    </header>
  );
}
