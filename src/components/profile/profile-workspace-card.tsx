"use client";

import {
  BadgeDollarSignIcon,
  Building2Icon,
  ChevronRightIcon,
  LayoutGridIcon,
  MapPinIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ProfileSectionCard } from "./profile-section-card";
import { Link } from "~/i18n/navigation";
import type { AgentArea } from "~/lib/agent/agent-area";

type WorkspaceLink = { key: string; href: string; icon: LucideIcon };

const LINKS: Record<AgentArea, WorkspaceLink[]> = {
  business: [
    { key: "settings", href: "/dashboard/settings", icon: SettingsIcon },
    {
      key: "subscription",
      href: "/dashboard/subscription",
      icon: BadgeDollarSignIcon,
    },
    { key: "branches", href: "/dashboard/branches", icon: MapPinIcon },
  ],
  corporate: [
    { key: "settings", href: "/corporate/settings", icon: Building2Icon },
    {
      key: "membership",
      href: "/corporate/membership",
      icon: BadgeDollarSignIcon,
    },
    { key: "locations", href: "/corporate/locations", icon: MapPinIcon },
  ],
  admin: [{ key: "settings", href: "/admin/settings", icon: SettingsIcon }],
};

/** Outgoing links: what belongs to the tenant lives on its own screen. */
export function ProfileWorkspaceCard({ area }: { area: AgentArea }) {
  const t = useTranslations("profile.workspace");

  return (
    <ProfileSectionCard
      id="workspace"
      title={t("title")}
      description={t("description")}
      icon={LayoutGridIcon}
    >
      <ul className="divide-hairline -my-1 divide-y">
        {LINKS[area].map(({ key, href, icon: Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="text-copy-sm focus-visible:ring-ring hover:bg-canvas-soft-2 -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none"
            >
              <Icon
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
              <span className="flex-1 font-medium">{t(`${area}.${key}`)}</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
            </Link>
          </li>
        ))}
      </ul>
    </ProfileSectionCard>
  );
}
