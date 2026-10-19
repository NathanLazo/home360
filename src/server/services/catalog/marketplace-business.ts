import "server-only";

import {
  BusinessStatus,
  SubscriptionStatus,
  type Prisma,
} from "@generated/prisma";

/**
 * F10 review L6: a business the marketplace may show and sell for. Mirrors
 * `activeBusinessProcedure` (ACTIVE status and a subscription that exists and
 * is not CANCELED): a business that could not fulfil an order (markDelivered,
 * redeemPickup… are blocked for it) must not be discoverable or purchasable,
 * or the buyer's escrow could only leave through a dispute. The single rule
 * shared by every catalog read and checkout entry point.
 */
export const marketplaceBusinessWhere = {
  status: BusinessStatus.ACTIVE,
  subscription: { is: { status: { not: SubscriptionStatus.CANCELED } } },
} satisfies Prisma.BusinessWhereInput;
