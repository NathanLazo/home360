import type { UserRole } from "@generated/prisma";

import {
  AppShellBreadcrumb,
  AppShellHeader,
  type AppShellBreadcrumbProps,
} from "~/components/app-shell";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { UserMenu } from "~/components/user-menu";

export type CorporateHeaderProps = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: UserRole;
  };
  toggleSidebarLabel: string;
  breadcrumb: AppShellBreadcrumbProps;
};

/** Corporate top row: "Account › Section" and the user menu. */
export function CorporateHeader({
  user,
  toggleSidebarLabel,
  breadcrumb,
}: CorporateHeaderProps) {
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
    </AppShellHeader>
  );
}
