import "server-only";

import type {
  PrismaClient,
  SubscriptionStatus,
} from "@generated/prisma";
import { countActiveOrders } from "~/server/services/business/order-activity";

export type DashboardShellData = {
  business: {
    id: string;
    name: string;
    status: string;
  };
  /** Drives the global subscription banner (F4-07). `null` = no plan yet. */
  subscription: {
    status: SubscriptionStatus;
    renewsAt: Date;
  } | null;
  branches: Array<{ id: string; name: string }>;
  activeOrdersCount: number;
};

export async function getDashboardShellData(
  db: PrismaClient,
  ownerId: string,
): Promise<DashboardShellData | null> {
  const record = await db.business.findUnique({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      status: true,
      // Same query as the shell: the banner costs no extra round trip.
      subscription: { select: { status: true, renewsAt: true } },
    },
  });

  if (!record) {
    return null;
  }

  const { subscription, ...business } = record;

  const [branches, activeOrdersCount] = await Promise.all([
    db.branch.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    countActiveOrders(db, business.id),
  ]);

  return { business, subscription, branches, activeOrdersCount };
}
