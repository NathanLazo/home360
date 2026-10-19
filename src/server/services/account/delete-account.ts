import "server-only";

import {
  BusinessStatus,
  OrderStatus,
  QuoteStatus,
  RequestStatus,
  SubscriptionStatus,
  type PrismaClient,
} from "@generated/prisma";

import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Money or work still in flight: the account cannot go away yet. */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SHIPPING,
  OrderStatus.DISPUTED,
];

const LIVE_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.OPEN,
  RequestStatus.QUOTED,
];

export const ACCOUNT_DELETED_REASON = "ACCOUNT_DELETED";

type DeleteAccountError =
  "ACCOUNT_HAS_ACTIVE_ORDERS" | "ACCOUNT_HAS_ACTIVE_SUBSCRIPTION";

/**
 * Self-service account deletion (App Store 5.1.1(v)) for the mobile roles.
 * Personal data is anonymized and credentials, devices and addresses are
 * dropped, but the user row stays (suspended, `deletedAt`) so orders,
 * payments, reviews and audits remain traceable. Suspension reuses the
 * existing guards: every session and mobile token is revoked and sign-in is
 * refused. A business is taken off the marketplace (SUSPENDED); a worker is
 * unlinked from its team row, which keeps the job history.
 */
export async function deleteMyAccount(
  db: PrismaClient,
  userId: string,
): Promise<ServiceResult<{ id: string }, DeleteAccountError>> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      business: {
        select: {
          id: true,
          subscription: { select: { status: true } },
        },
      },
      workerProfile: { select: { id: true } },
    },
  });

  if (!user) {
    return svcFail("NOT_FOUND", "User not found");
  }

  const { business, workerProfile } = user;
  const activeOrders = await db.order.count({
    where: {
      status: { in: ACTIVE_ORDER_STATUSES },
      OR: [
        { customerId: user.id },
        ...(business ? [{ businessId: business.id }] : []),
        ...(workerProfile ? [{ workerId: workerProfile.id }] : []),
      ],
    },
  });

  if (activeOrders > 0) {
    return svcFail("ACCOUNT_HAS_ACTIVE_ORDERS");
  }

  if (
    business?.subscription &&
    business.subscription.status !== SubscriptionStatus.CANCELED
  ) {
    return svcFail("ACCOUNT_HAS_ACTIVE_SUBSCRIPTION");
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    const liveRequests = await tx.serviceRequest.findMany({
      where: { customerId: user.id, status: { in: LIVE_REQUEST_STATUSES } },
      select: { id: true },
    });
    const liveRequestIds = liveRequests.map((request) => request.id);

    await tx.quote.updateMany({
      where: {
        requestId: { in: liveRequestIds },
        status: QuoteStatus.PENDING,
      },
      data: { status: QuoteStatus.EXPIRED },
    });
    await tx.serviceRequest.updateMany({
      where: { id: { in: liveRequestIds } },
      data: { status: RequestStatus.CANCELLED },
    });

    if (business) {
      await tx.business.update({
        where: { id: business.id },
        data: { status: BusinessStatus.SUSPENDED },
      });
    }

    if (workerProfile) {
      await tx.worker.update({
        where: { id: workerProfile.id },
        data: {
          userId: null,
          invitedEmail: null,
          lastLatitude: null,
          lastLongitude: null,
          locationUpdatedAt: null,
        },
      });
    }

    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.pushToken.deleteMany({ where: { userId: user.id } });
    await tx.address.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.customerProfile.deleteMany({ where: { userId: user.id } });

    await tx.user.update({
      where: { id: user.id },
      data: {
        name: null,
        email: `deleted-${user.id}@deleted.home360.invalid`,
        emailVerified: null,
        image: null,
        avatarPathname: null,
        passwordHash: null,
        deletedAt: now,
        suspendedAt: now,
        suspensionReason: ACCOUNT_DELETED_REASON,
        sessionsValidFrom: now,
      },
    });
  });

  return svcOk({ id: user.id });
}
