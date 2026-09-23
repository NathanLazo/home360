"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import { UserAvatar } from "~/components/user-avatar";
import { Link, usePathname } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badgeCount?: number;
};

export type AppSidebarProps = {
  variant: "light" | "dark";
  items: SidebarItem[];
  homeHref: string;
  brandLabel: string;
  mobileTitle: string;
  mobileDescription: string;
  user: {
    name: string;
    subtitle?: string;
    /** Stable user id (or email) for the bot avatar; defaults to the name. */
    seed?: string;
    image?: string | null;
  };
  footerSlot?: ReactNode;
};

function matchesPath(pathname: string, href: string) {
  const hrefPath = href.split(/[?#]/, 1)[0] ?? href;
  const normalizedHref =
    hrefPath.length > 1 ? hrefPath.replace(/\/$/, "") : hrefPath;

  const isTopLevelRoute = normalizedHref.split("/").filter(Boolean).length <= 1;

  if (isTopLevelRoute) {
    return pathname === normalizedHref;
  }

  return (
    pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`)
  );
}

export function AppSidebar({
  variant,
  items,
  homeHref,
  brandLabel,
  mobileTitle,
  mobileDescription,
  user,
  footerSlot,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      mobileTitle={mobileTitle}
      mobileDescription={mobileDescription}
      className={cn(variant === "dark" && "dark")}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href={homeHref} aria-label={brandLabel}>
                <span
                  aria-hidden="true"
                  className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
                >
                  H
                </span>
                <span className="truncate text-sm font-semibold tracking-tight">
                  HOME360
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ icon: Icon, ...item }) => {
                const isActive = matchesPath(pathname, item.href);
                const tooltip =
                  item.badgeCount !== undefined
                    ? `${item.label} (${item.badgeCount})`
                    : item.label;

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={tooltip}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badgeCount !== undefined ? (
                      <SidebarMenuBadge className="bg-sidebar-foreground text-sidebar peer-hover/menu-button:text-sidebar peer-data-[active=true]/menu-button:text-sidebar rounded-full font-mono tabular-nums">
                        {item.badgeCount}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {footerSlot}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="cursor-default hover:bg-transparent active:scale-100 active:bg-transparent"
            >
              <div>
                <UserAvatar
                  seed={user.seed ?? user.name}
                  name={user.name}
                  image={user.image}
                  theme={variant}
                  className="rounded-md"
                />
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                  {user.subtitle ? (
                    <span className="text-sidebar-foreground/70 truncate text-xs">
                      {user.subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
