import "server-only";

import type {
  BusinessStatus,
  PrismaClient,
  SubscriptionStatus,
} from "@generated/prisma";
import { countActiveOrders } from "~/server/services/business/order-activity";
import { requiresPlanSelection } from "~/server/services/subscription/plan-selection";

export type DashboardShellData = {
  business: {
    id: string;
    name: string;
    /** Drives the approval banner and read-only CTAs (`activeBusinessProcedure`). */
    status: BusinessStatus;
  };
  /** Drives the global subscription banner (F4-07). `null` = no plan yet. */
  subscription: {
    status: SubscriptionStatus;
    renewsAt: Date;
  } | null;
  /** The business has to pick and pay a plan through Checkout (§8). */
  needsPlan: boolean;
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
      subscription: {
        select: {
          status: true,
          renewsAt: true,
          stripeSubscriptionId: true,
          _count: { select: { invoices: { where: { status: "PAID" } } } },
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const { subscription: subscriptionRecord, ...business } = record;
  const needsPlan = requiresPlanSelection(
    subscriptionRecord
      ? {
          status: subscriptionRecord.status,
          stripeSubscriptionId: subscriptionRecord.stripeSubscriptionId,
          paidInvoiceCount: subscriptionRecord._count.invoices,
        }
      : null,
  );
  const subscription = subscriptionRecord
    ? {
        status: subscriptionRecord.status,
        renewsAt: subscriptionRecord.renewsAt,
      }
    : null;

  const [branches, activeOrdersCount] = await Promise.all([
    db.branch.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    countActiveOrders(db, business.id),
  ]);

  return { business, subscription, needsPlan, branches, activeOrdersCount };
}
