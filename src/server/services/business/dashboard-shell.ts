import "server-only";

import type { PrismaClient } from "../../../../generated/prisma";
import { countActiveOrders } from "~/server/services/business/order-activity";

export type DashboardShellData = {
  business: {
    id: string;
    name: string;
    status: string;
  };
  branches: Array<{ id: string; name: string }>;
  activeOrdersCount: number;
};

export async function getDashboardShellData(
  db: PrismaClient,
  ownerId: string,
): Promise<DashboardShellData | null> {
  const business = await db.business.findUnique({
    where: { ownerId },
    select: { id: true, name: true, status: true },
  });

  if (!business) {
    return null;
  }

  const [branches, activeOrdersCount] = await Promise.all([
    db.branch.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    countActiveOrders(db, business.id),
  ]);

  return { business, branches, activeOrdersCount };
}
