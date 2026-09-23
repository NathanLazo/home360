import {
  BadgeCheckIcon,
  ClipboardListIcon,
  HomeIcon,
  MapPinIcon,
  SettingsIcon,
} from "lucide-react";

export const CORPORATE_NAV = [
  {
    key: "home",
    href: "/corporate",
    icon: HomeIcon,
  },
  {
    key: "orders",
    href: "/corporate/orders",
    icon: ClipboardListIcon,
  },
  {
    key: "locations",
    href: "/corporate/locations",
    icon: MapPinIcon,
  },
  {
    key: "membership",
    href: "/corporate/membership",
    icon: BadgeCheckIcon,
  },
  {
    key: "settings",
    href: "/corporate/settings",
    icon: SettingsIcon,
  },
] as const;

export type CorporateNavKey = (typeof CORPORATE_NAV)[number]["key"];
