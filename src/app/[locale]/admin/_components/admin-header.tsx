import type { UserRole } from "../../../../../generated/prisma";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { UserMenu } from "~/components/user-menu";

export type AdminHeaderProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
};

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="flex min-h-16 items-center justify-end gap-2 border-b border-zinc-800 bg-[#18181b] px-4 sm:px-6">
      <LocaleSwitcher />
      <UserMenu {...user} variant="dark" />
    </header>
  );
}
