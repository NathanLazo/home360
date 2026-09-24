import {
  BanknoteIcon,
  Building2Icon,
  LayoutDashboardIcon,
  ScaleIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";

import type { SidebarItem } from "~/components/app-sidebar";

export type SidebarNavDefinition = Omit<SidebarItem, "label"> & {
  labelKey: string;
};

export const adminNav: SidebarNavDefinition[] = [
  {
    key: "overview",
    labelKey: "nav.overview",
    href: "/admin",
    icon: LayoutDashboardIcon,
  },
  {
    key: "users",
    labelKey: "nav.users",
    href: "/admin/users",
    icon: UsersIcon,
  },
  {
    key: "disputes",
    labelKey: "nav.disputes",
    href: "/admin/disputes",
    icon: ScaleIcon,
  },
  {
    key: "finance",
    labelKey: "nav.finance",
    href: "/admin/finance",
    icon: BanknoteIcon,
  },
  {
    key: "corporate",
    labelKey: "nav.corporate",
    href: "/admin/corporate",
    icon: Building2Icon,
  },
  {
    key: "assistant",
    labelKey: "nav.assistant",
    href: "/admin/assistant",
    icon: SparklesIcon,
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    href: "/admin/settings",
    icon: SettingsIcon,
  },
];
