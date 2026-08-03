import type { ReactNode } from "react";

import {
  SidebarNavItem,
  type SidebarItem,
} from "~/components/sidebar-nav-item";
import { SidebarUserCard } from "~/components/sidebar-user-card";
import { cn } from "~/lib/utils";

export type { SidebarItem } from "~/components/sidebar-nav-item";

export type AppSidebarProps = {
  variant: "light" | "dark";
  items: SidebarItem[];
  className?: string;
  user: {
    name: string;
    subtitle?: string;
    initials: string;
  };
  footerSlot?: ReactNode;
};

export function AppSidebar({
  variant,
  items,
  className,
  user,
  footerSlot,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r p-4",
        variant === "light"
          ? "border-zinc-200 bg-white text-zinc-950"
          : "border-zinc-800 bg-[#18181b] text-zinc-100",
        className,
      )}
    >
      <nav className="min-h-0 flex-1 py-2">
        <ul className="flex flex-col gap-1">
          {items.map(({ icon: Icon, ...item }) => (
            <li key={item.key}>
              <SidebarNavItem
                item={item}
                icon={<Icon aria-hidden="true" />}
                variant={variant}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-3 pt-4">
        {footerSlot}
        <SidebarUserCard variant={variant} {...user} />
      </div>
    </aside>
  );
}
