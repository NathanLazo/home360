"use client";

import { LoaderCircleIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";

import type { ProfileDevice } from "./profile.types";
import { MOTION_DURATION_MS, MOTION_EASE } from "~/components/motion";
import { Button } from "~/components/ui/button";

/** Siblings settle into the gap with a firm spring (no overshoot). */
const SPRING_LAYOUT = { type: "spring", stiffness: 500, damping: 40 } as const;
const EXIT = {
  duration: MOTION_DURATION_MS.quick / 1000,
  ease: MOTION_EASE.smoothOut,
} as const;

export function ProfileDeviceRow({
  device,
  disabled,
  removing,
  onRemove,
}: {
  device: ProfileDevice;
  disabled: boolean;
  removing: boolean;
  onRemove: (deviceId: string) => void;
}) {
  const t = useTranslations("profile.devices");
  const format = useFormatter();
  const reduceMotion = useReducedMotion() === true;
  const name = device.deviceName?.trim() ? device.deviceName : t("unnamed");
  const platform = t(`platform.${device.platform}`);

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      transition={SPRING_LAYOUT}
      exit={{ opacity: 0, transition: EXIT }}
      className="flex items-center gap-3 py-3"
    >
      <span
        aria-hidden="true"
        className="bg-canvas-soft text-muted-foreground shadow-hairline flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <SmartphoneIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-copy-sm truncate font-medium">
          {name}
          <span className="text-muted-foreground font-normal">
            {" "}
            · {platform}
          </span>
        </p>
        <p className="text-muted-foreground text-label font-mono">
          {t("lastSeen", {
            date: format.dateTime(device.lastSeenAt, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("removeLabel", { name: `${name} (${platform})` })}
        aria-busy={removing || undefined}
        disabled={disabled || removing}
        onClick={() => onRemove(device.id)}
      >
        {removing ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <XIcon aria-hidden="true" />
        )}
        {t("remove")}
      </Button>
    </motion.li>
  );
}
