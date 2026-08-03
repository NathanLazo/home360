import {
  BadgeDollarSignIcon,
  ClipboardListIcon,
  CreditCardIcon,
  HomeIcon,
  MapPinIcon,
  PackageIcon,
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
] as const;

export type DashboardNavKey = (typeof DASHBOARD_NAV)[number]["key"];
