import type { UserRole } from "@generated/prisma";

import { GlassSurface } from "~/components/glass";
import { LocaleSwitcher } from "~/components/locale-switcher";
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
  /** Role label shown as a static-chrome identity chip. */
  roleLabel: string;
};

/**
 * Admin top bar: the same floating Liquid Glass toolbar as the dashboard and
 * corporate shells (solid canvas on first paint and under reduced
 * transparency / more contrast). The role chip is static chrome (`bg-metal`,
 * no WebGL) so every admin screen keeps its live-metal budget for the
 * decisive action (resolve dispute, save settings).
 */
export function AdminHeader({
  user,
  toggleSidebarLabel,
  roleLabel,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-2 pt-2 sm:px-3">
      <GlassSurface
        radius="pill"
        className="flex min-h-12 items-center gap-2 px-3 py-1.5 sm:pr-1.5"
      >
        <SidebarTrigger aria-label={toggleSidebarLabel} className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-4"
        />
        <span className="bg-metal text-ink shadow-hairline inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium tracking-tight">
          {roleLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <UserMenu {...user} variant="light" />
        </div>
      </GlassSurface>
    </header>
  );
}
