import type { UserRole } from "../../../../../generated/prisma";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { UserMenu } from "~/components/user-menu";

export type AdminHeaderProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  toggleSidebarLabel: string;
};

export function AdminHeader({ user, toggleSidebarLabel }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-zinc-800 bg-[#18181b] px-4 sm:px-6">
      <SidebarTrigger
        aria-label={toggleSidebarLabel}
        className="-ml-1.5 text-zinc-100 hover:bg-zinc-800 hover:text-white"
      />
      <Separator
        orientation="vertical"
        className="mr-1 bg-zinc-800 data-[orientation=vertical]:h-4"
      />
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <UserMenu {...user} variant="dark" />
      </div>
    </header>
  );
}
