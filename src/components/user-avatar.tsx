"use client";

import type { ComponentProps } from "react";

import { UserBotAvatar } from "~/components/bot";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

type BotProps = ComponentProps<typeof UserBotAvatar>;

export type UserAvatarProps = {
  /** Stable identity (user id, worker id or email): same seed, same bot. */
  seed: string;
  /** Display name, used as the bot's label. */
  name: string;
  /** Real photo; the bot is only the fallback. */
  image?: string | null;
  /** Rendered size in px (square). */
  size?: number;
  /** Pointer-follow + hop on click. Only for the viewer's own avatar. */
  interactive?: boolean;
  state?: BotProps["state"];
  theme?: BotProps["theme"];
  className?: string;
};

/**
 * Avatar for a person: their photo when there is one, otherwise a seeded bot.
 * Decorative — every placement sits next to the name or inside a labelled
 * control, so the avatar itself is hidden from assistive tech.
 */
export function UserAvatar({
  seed,
  name,
  image,
  size = 32,
  interactive = false,
  state,
  theme = "light",
  className,
}: UserAvatarProps) {
  return (
    <Avatar
      aria-hidden="true"
      style={{ width: size, height: size }}
      // The bot draws its hop inside its own canvas; only the photo is clipped.
      className={cn("overflow-visible", className)}
    >
      {image ? (
        <AvatarImage src={image} alt="" className="rounded-[inherit]" />
      ) : null}
      <AvatarFallback
        delayMs={image ? 600 : undefined}
        className="rounded-[inherit] bg-transparent"
      >
        <UserBotAvatar
          seed={seed}
          label={name}
          size={size}
          state={state}
          interactive={interactive}
          theme={theme}
        />
      </AvatarFallback>
    </Avatar>
  );
}
