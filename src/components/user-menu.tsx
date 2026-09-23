import type { UserRole } from "@generated/prisma";
import { getTranslations } from "next-intl/server";

import { MetalRing } from "~/components/metal";
import { SignOutItem } from "~/components/sign-out-item";
import { UserAvatar } from "~/components/user-avatar";
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
  /** Stable user id; seeds the bot avatar. Falls back to the email. */
  id?: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  variant: "light" | "dark";
  /**
   * Thin silver ring on the avatar trigger. Opt-in, for shells that carry no
   * other persistent metal (the dashboard and corporate shells already show
   * the plan chip in the sidebar, so they leave this off).
   */
  metalAvatar?: boolean;
};

export async function UserMenu({
  id,
  name,
  email,
  image,
  role,
  variant,
  metalAvatar = false,
}: UserMenuProps) {
  const t = await getTranslations("common.userMenu");
  const seed = id ?? email;
  const botTheme = variant === "dark" ? "dark" : "light";

  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("open")}
        className={cn(
          "rounded-full",
          variant === "dark" && "dark text-foreground",
        )}
      >
        <UserAvatar
          seed={seed}
          name={name}
          image={image}
          theme={botTheme}
          interactive
        />
      </Button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {metalAvatar ? (
        <MetalRing variant="circle" theme={variant} strength={0.45} disableGlow>
          {trigger}
        </MetalRing>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        align="end"
        className={cn("w-64", variant === "dark" && "dark")}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-start gap-3 font-normal">
            <UserAvatar
              seed={seed}
              name={name}
              image={image}
              size={40}
              theme={botTheme}
              interactive
            />
            <span className="flex min-w-0 flex-col gap-1">
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
