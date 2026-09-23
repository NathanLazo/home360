import type { UserRole } from "@generated/prisma";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { MetalPill } from "~/components/metal";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { UserMenu } from "~/components/user-menu";

export type AdminHeaderProps = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: UserRole;
  };
  toggleSidebarLabel: string;
  /** Role label shown as the shell's single metal detail. */
  roleLabel: string;
};

/**
 * Admin top bar: a solid canvas strip with a hairline, the same chrome the
 * business dashboard uses, so the ink sidebar alone carries the "operator
 * mode" weight. It stays solid (no glass): it is persistent structure over
 * dense tables, and the screens' one glass surface is reserved for their
 * decisive action bar (settings save, dispute resolution).
 */
export function AdminHeader({
  user,
  toggleSidebarLabel,
  roleLabel,
}: AdminHeaderProps) {
  return (
    <header className="bg-canvas border-hairline sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b px-4 sm:px-6">
      <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1.5" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      {/* Identity marker, not a control: the admin shell's only metal. */}
      <MetalPill label={roleLabel} scale={0.9} theme="light" />
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <UserMenu {...user} variant="light" />
      </div>
    </header>
  );
}
