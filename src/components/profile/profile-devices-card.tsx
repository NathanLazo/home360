"use client";

import { SmartphoneIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import { ProfileDeviceRow } from "./profile-device-row";
import { ProfileSectionCard } from "./profile-section-card";
import type { ProfileDevice } from "./profile.types";

export function ProfileDevicesCard({
  devices,
  disabled,
  removingDeviceId,
  onRemove,
}: {
  devices: ProfileDevice[];
  disabled: boolean;
  removingDeviceId: string | null;
  onRemove: (deviceId: string) => void;
}) {
  const t = useTranslations("profile.devices");

  return (
    <ProfileSectionCard
      id="devices"
      title={t("title")}
      description={t("description")}
      icon={SmartphoneIcon}
      action={
        <span className="text-muted-foreground text-label font-mono tabular-nums">
          {devices.length}
        </span>
      }
    >
      {devices.length === 0 ? (
        <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-xl px-4 py-3">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-hairline -my-3 divide-y">
          <AnimatePresence initial={false}>
            {devices.map((device) => (
              <ProfileDeviceRow
                key={device.id}
                device={device}
                disabled={disabled}
                removing={removingDeviceId === device.id}
                onRemove={onRemove}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </ProfileSectionCard>
  );
}
