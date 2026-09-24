import type { UserRole } from "@generated/prisma";

import {
  AppShellBreadcrumb,
  AppShellHeader,
  type AppShellBreadcrumbProps,
} from "~/components/app-shell";
import { LocaleSwitcher } from "~/components/locale-switcher";
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
  breadcrumb: AppShellBreadcrumbProps;
};

/**
 * Admin top row: "HOME360 › Section" with the role chip as static chrome
 * (`bg-metal`, no WebGL) so every admin screen keeps its live-metal budget
 * for the decisive action (resolve dispute, save settings).
 */
export function AdminHeader({
  user,
  toggleSidebarLabel,
  roleLabel,
  breadcrumb,
}: AdminHeaderProps) {
  return (
    <AppShellHeader
      toggleSidebarLabel={toggleSidebarLabel}
      actions={
        <>
          <span className="md:hidden">
            <LocaleSwitcher />
          </span>
          <UserMenu {...user} variant="light" />
        </>
      }
    >
      <AppShellBreadcrumb {...breadcrumb} />
      <span className="bg-metal text-ink shadow-hairline ml-1 inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-medium tracking-tight">
        {roleLabel}
      </span>
    </AppShellHeader>
  );
}
