import {
  BadgeDollarSignIcon,
  ClipboardListIcon,
  CreditCardIcon,
  HomeIcon,
  MapPinIcon,
  PackageIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";

export const DASHBOARD_NAV = [
  {
    key: "home",
    labelKey: "nav.home",
    href: "/dashboard",
    icon: HomeIcon,
  },
  {
    key: "services",
    labelKey: "nav.services",
    href: "/dashboard/services",
    icon: WrenchIcon,
  },
  {
    key: "products",
    labelKey: "nav.products",
    href: "/dashboard/products",
    icon: PackageIcon,
  },
  {
    key: "orders",
    labelKey: "nav.orders",
    href: "/dashboard/orders",
    icon: ClipboardListIcon,
  },
  {
    key: "payments",
    labelKey: "nav.payments",
    href: "/dashboard/payments",
    icon: CreditCardIcon,
  },
  {
    key: "subscription",
    labelKey: "nav.subscription",
    href: "/dashboard/subscription",
    icon: BadgeDollarSignIcon,
  },
  {
    key: "branches",
    labelKey: "nav.branches",
    href: "/dashboard/branches",
    icon: MapPinIcon,
  },
  {
    key: "team",
    labelKey: "nav.team",
    href: "/dashboard/team",
    icon: UsersIcon,
  },
  {
    key: "assistant",
    labelKey: "nav.assistant",
    href: "/dashboard/assistant",
    icon: SparklesIcon,
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    href: "/dashboard/settings",
    icon: SettingsIcon,
  },
] as const;

export type DashboardNavKey = (typeof DASHBOARD_NAV)[number]["key"];
