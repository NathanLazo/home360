import type { UserRole } from "../../generated/prisma";
import { getTranslations } from "next-intl/server";

import { SignOutItem } from "~/components/sign-out-item";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type UserMenuProps = {
  name: string;
  email: string;
  role: UserRole;
  variant: "light" | "dark";
};

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || email.slice(0, 2).toUpperCase();
}

export async function UserMenu({ name, email, role, variant }: UserMenuProps) {
  const t = await getTranslations("common.userMenu");
  const initials = getInitials(name, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("open")}
          className={cn(
            "rounded-full",
            variant === "dark" && "text-zinc-100 hover:bg-zinc-800",
          )}
        >
          <Avatar>
            <AvatarFallback
              className={cn(variant === "dark" && "bg-zinc-800 text-zinc-100")}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-64", variant === "dark" && "dark")}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <span className="truncate font-medium">{name}</span>
            <span
              className="text-muted-foreground truncate text-xs"
              title={email}
            >
              {email}
            </span>
            <span className="text-muted-foreground text-xs">
              {t(`roles.${role}`)}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <SignOutItem label={t("signOut")} pendingLabel={t("signingOut")} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
