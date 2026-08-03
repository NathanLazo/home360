"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Link, usePathname } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badgeCount?: number;
};

export type SidebarNavItemProps = {
  item: Omit<SidebarItem, "icon">;
  icon: ReactNode;
  variant: "light" | "dark";
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

export function SidebarNavItem({ item, icon, variant }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = matchesPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
        variant === "light"
          ? isActive
            ? "bg-zinc-100 text-zinc-950"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          : isActive
            ? "bg-zinc-800 text-white"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badgeCount !== undefined ? (
        <Badge
          variant={variant === "light" ? "secondary" : "outline"}
          className={cn(variant === "dark" && "border-zinc-700 text-zinc-200")}
        >
          {item.badgeCount}
        </Badge>
      ) : null}
    </Link>
  );
}
