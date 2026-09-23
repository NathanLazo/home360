"use client";

import {
  BotAvatar,
  type BotAvatarState,
  type BotAvatarType,
} from "bot-avatars";

import { cn } from "~/lib/utils";

/** Rounded silhouettes that read well at 24–40 px. */
const TYPES: readonly BotAvatarType[] = [
  "clover",
  "flower",
  "blob",
  "ghost",
  "circle",
  "drop",
  "star",
  "droid",
  "alien",
  "hexagon",
  "cat",
  "cloud",
  "pill",
  "pebble",
];

/** FNV-1a — stable across renders, server and client. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type UserBotAvatarProps = {
  /** Stable identity (user id or email) — same seed, same bot. */
  seed: string;
  /** Accessible name, e.g. the user's display name. */
  label: string;
  size?: number;
  state?: BotAvatarState;
  /** Follow the pointer and hop on click. Off inside dense lists. */
  interactive?: boolean;
  theme?: "light" | "dark" | "auto";
  className?: string;
};

/**
 * Fallback avatar for users without a photo: a small 3D bot whose shape and
 * colour derive from `seed`. Canvas 2D (no WebGL); the library honours
 * prefers-reduced-motion and pauses offscreen.
 */
export function UserBotAvatar({
  seed,
  label,
  size = 32,
  state = "default",
  interactive = false,
  theme = "light",
  className,
}: UserBotAvatarProps) {
  const h = hash(seed);
  const type = TYPES[h % TYPES.length] ?? "circle";

  return (
    <BotAvatar
      type={type}
      size={size}
      state={state}
      seed={(h % 1000) / 1000}
      saturation={0.85}
      interactive={interactive}
      theme={theme}
      jumpEvery={interactive ? 8 : 0}
      aria-label={label}
      className={cn("shrink-0", className)}
    />
  );
}
