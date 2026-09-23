import {
  type DisputeStatus,
  type OrderStatus,
  type PrismaClient,
  UserRole,
} from "@generated/prisma";

import type { UserAccessStatus } from "~/app/[locale]/admin/users/_components/users.schema";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

type CustomerDetailDb = Pick<PrismaClient, "user" | "review" | "dispute">;

const RECENT_ITEMS = 5;

export interface CustomerDetail {
  id: string;
  name: string | null;
  email: string | null;
  locale: string;
  createdAt: Date;
  accessStatus: UserAccessStatus;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  addressesCount: number;
  ordersCount: number;
  recentOrders: Array<{
    id: string;
    folio: number;
    title: string;
    amountCents: number;
    status: OrderStatus;
    businessName: string;
    createdAt: Date;
  }>;
  reviews: {
    count: number;
    averageRating: number | null;
    items: Array<{
      id: string;
      rating: number;
      comment: string | null;
      businessName: string;
      createdAt: Date;
    }>;
  };
  disputes: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      status: DisputeStatus;
      businessName: string;
      createdAt: Date;
    }>;
  };
}

/**
 * W10 customer sheet: profile, activity and conflict history in one read.
 * Only CUSTOMER users resolve; any other role is "not found" for this view.
 */
export async function getCustomerDetail(
  deps: { db: CustomerDetailDb },
  input: { userId: string },
): Promise<ServiceResult<CustomerDetail>> {
  const customerDisputes = { order: { customerId: input.userId } };

  const [user, reviewStats, disputesCount, disputes] = await Promise.all([
    deps.db.user.findFirst({
      where: { id: input.userId, role: UserRole.CUSTOMER },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        createdAt: true,
        suspendedAt: true,
        suspensionReason: true,
        _count: { select: { addresses: true, orders: true } },
        orders: {
          take: RECENT_ITEMS,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            folio: true,
            title: true,
            amountCents: true,
            status: true,
            createdAt: true,
            business: { select: { name: true } },
          },
        },
        reviews: {
          take: RECENT_ITEMS,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            order: { select: { business: { select: { name: true } } } },
          },
        },
      },
    }),
    deps.db.review.aggregate({
      where: { customerId: input.userId },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    deps.db.dispute.count({ where: customerDisputes }),
    deps.db.dispute.findMany({
      where: customerDisputes,
      take: RECENT_ITEMS,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        business: { select: { name: true } },
      },
    }),
  ]);

  if (!user) {
    return svcFail("NOT_FOUND", "Customer not found");
  }

  return svcOk({
    id: user.id,
    name: user.name,
    email: user.email,
    locale: user.locale,
    createdAt: user.createdAt,
    accessStatus: user.suspendedAt === null ? "active" : "suspended",
    suspendedAt: user.suspendedAt,
    suspensionReason: user.suspensionReason,
    addressesCount: user._count.addresses,
    ordersCount: user._count.orders,
    recentOrders: user.orders.map(({ business, ...order }) => ({
      ...order,
      businessName: business.name,
    })),
    reviews: {
      count: reviewStats._count._all,
      averageRating: reviewStats._avg.rating,
      items: user.reviews.map(({ order, ...review }) => ({
        ...review,
        businessName: order.business.name,
      })),
    },
    disputes: {
      count: disputesCount,
      items: disputes.map(({ business, ...dispute }) => ({
        ...dispute,
        businessName: business.name,
      })),
    },
  });
}
