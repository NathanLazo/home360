import type { RouterOutputs } from "~/trpc/react";

type DashboardOutput = RouterOutputs["dashboard"];

export type DashboardKpis = NonNullable<DashboardOutput["getKpis"]["result"]>;
export type WeeklyRevenuePoint = NonNullable<
  DashboardOutput["getWeeklyRevenue"]["result"]
>[number];
export type OrdersByBranchRow = NonNullable<
  DashboardOutput["getOrdersByBranch"]["result"]
>[number];
export type RecentOrder = NonNullable<
  DashboardOutput["getRecentOrders"]["result"]
>[number];
export type NotificationFeed = NonNullable<
  DashboardOutput["getNotifications"]["result"]
>;
export type NotificationItem = NotificationFeed["items"][number];
