import "server-only";

import {
  BranchStatus,
  FulfillmentMethod,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  ProductStatus,
  StockMovementType,
  type Prisma,
} from "@generated/prisma";

import { marketplaceBusinessWhere } from "~/server/services/catalog/marketplace-business";
import {
  productBranchStockSelect,
  rankDeliveryBranches,
  validatePickupBranch,
} from "~/server/services/catalog/product-availability";
import {
  closePendingOrder,
  voidIntentsAfterClose,
} from "~/server/services/orders/cancel-unpaid-order";
import {
  recordStockMovement,
  reserveProductStock,
} from "~/server/services/orders/stock-hold";
import {
  resolveUnpaidOrderTtlMinutes,
  unpaidOrderCutoff,
} from "~/server/services/orders/unpaid-order-ttl";
import {
  createOrderPaymentIntent,
  type CheckoutIntentResult,
  type CustomerCheckoutDeps,
} from "~/server/services/payments/customer-checkout";
import { runSerializable } from "~/server/services/serializable-tx";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

const MAX_PRISMA_INT = 2_147_483_647;
/**
 * F10 review M4: open (PENDING) PRODUCT orders a customer may hold at once.
 * Each one reserves stock, so without a cap one account could reserve a
 * product's whole availability by cycling quantities / addresses / branches.
 * A new checkout over the cap replaces the customer's oldest open order
 * (cancelled and its units released in the same transaction).
 */
export const MAX_OPEN_PRODUCT_ORDERS_PER_CUSTOMER = 3;

export type ProductCheckoutErrorCode =
  | "BUSINESS_NOT_ACTIVE"
  | "ORDER_EXPIRED"
  | "OUT_OF_STOCK"
  | "PICKUP_NOT_AVAILABLE"
  | "DELIVERY_NOT_AVAILABLE"
  | "VALIDATION_ERROR";

export type ProductCheckoutInput = {
  customerId: string;
  productId: string;
  quantity: number;
  fulfillmentMethod: FulfillmentMethod;
  /** Required for DELIVERY: an own saved address (snapshot on the order). */
  addressId?: string;
  /** Required for PICKUP: an ACTIVE pickup-enabled branch of the business. */
  branchId?: string;
};

type DeliveryTarget =
  | {
      method: typeof FulfillmentMethod.DELIVERY;
      addressLine: string;
      latitude: number;
      longitude: number;
    }
  | { method: typeof FulfillmentMethod.PICKUP; branchId: string };

type PendingOrderPlan = {
  productId: string;
  title: string;
  businessId: string;
  amountCents: number;
  target: DeliveryTarget;
};

type PendingOrderOutcome = {
  orderId: string;
  /** PaymentIntents of replaced orders (M4), voided after the transaction. */
  replacedIntents: { orderId: string; intentIds: string[] }[];
};

type PendingOrderErrorCode = "OUT_OF_STOCK" | "DELIVERY_NOT_AVAILABLE";

function targetWhere(target: DeliveryTarget): Prisma.OrderWhereInput {
  return target.method === FulfillmentMethod.PICKUP
    ? { branchId: target.branchId }
    : {
        deliveryAddressLine: target.addressLine,
        deliveryLatitude: target.latitude,
        deliveryLongitude: target.longitude,
      };
}

/**
 * Branches to try, in order. PICKUP is the customer's (validated) branch.
 * DELIVERY is re-ranked from the stock read inside the transaction (L8), so
 * a branch emptied concurrently is skipped instead of failing the checkout.
 */
async function candidateBranches(
  tx: Prisma.TransactionClient,
  plan: PendingOrderPlan,
  quantity: number,
): Promise<ServiceResult<string[], PendingOrderErrorCode>> {
  if (plan.target.method === FulfillmentMethod.PICKUP) {
    return svcOk([plan.target.branchId]);
  }

  const rows = await tx.productStock.findMany({
    where: { productId: plan.productId },
    select: productBranchStockSelect,
  });
  const ranking = rankDeliveryBranches(rows, quantity, {
    latitude: plan.target.latitude,
    longitude: plan.target.longitude,
  });

  return ranking.ok
    ? svcOk(ranking.branchIds)
    : svcFail(ranking.code, "No branch can deliver this order");
}

/**
 * M4: keeps the customer at most `MAX_OPEN_PRODUCT_ORDERS_PER_CUSTOMER` open
 * PRODUCT orders counting the one about to be created. The oldest extra ones
 * are closed like the customer's own unpaid cancel (`closePendingOrder`:
 * CANCELLED event, PENDING Payment rows removed, units released with their
 * ledger row) inside the caller's transaction; their intents are returned
 * so they are voided after it. An order whose intent may already carry
 * money is still closed: a late capture is refunded (`ORDER_NOT_PAYABLE`).
 */
async function replaceOldestOpenOrders(
  tx: Prisma.TransactionClient,
  input: { customerId: string; keepOrderId: string; now: Date },
): Promise<PendingOrderOutcome["replacedIntents"]> {
  const older = await tx.order.findMany({
    where: {
      customerId: input.customerId,
      type: OrderType.PRODUCT,
      status: OrderStatus.PENDING,
      id: { not: input.keepOrderId },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  // The new order counts towards the cap.
  const excess = older.length + 1 - MAX_OPEN_PRODUCT_ORDERS_PER_CUSTOMER;
  const replaced: PendingOrderOutcome["replacedIntents"] = [];

  for (const order of older.slice(0, Math.max(0, excess))) {
    const closed = await closePendingOrder(tx, {
      orderId: order.id,
      actorUserId: input.customerId,
      eventType: OrderEventType.CANCELLED,
      stockReason: "REPLACED_BY_NEWER_CHECKOUT",
      now: input.now,
    });

    if (closed && closed.removedIntentIds.length > 0) {
      replaced.push({ orderId: order.id, intentIds: closed.removedIntentIds });
    }
  }

  return replaced;
}

/**
 * Finds the customer's open PENDING order for the same product, quantity and
 * fulfillment (D10-7) or creates one, reserving the stock atomically in the
 * same Serializable transaction (D10-4) together with its RESERVE ledger row
 * (F10-b). Over the per-customer cap the oldest open order is replaced (M4).
 */
async function findOrCreatePendingOrder(
  deps: Pick<CustomerCheckoutDeps, "db">,
  input: ProductCheckoutInput,
  plan: PendingOrderPlan,
): Promise<ServiceResult<PendingOrderOutcome, PendingOrderErrorCode>> {
  const ttlMinutes = await resolveUnpaidOrderTtlMinutes(deps.db);

  return runSerializable<
    ServiceResult<PendingOrderOutcome, PendingOrderErrorCode>
  >(
    deps.db,
    async (tx) => {
      const now = new Date();
      const existing = await tx.order.findFirst({
        where: {
          customerId: input.customerId,
          type: OrderType.PRODUCT,
          status: OrderStatus.PENDING,
          productId: plan.productId,
          quantity: input.quantity,
          fulfillmentMethod: plan.target.method,
          createdAt: { gt: unpaidOrderCutoff(ttlMinutes, now) },
          ...targetWhere(plan.target),
          OR: [
            { payment: { is: null } },
            { payment: { is: { status: PaymentStatus.PENDING } } },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      if (existing) {
        return svcOk({ orderId: existing.id, replacedIntents: [] });
      }

      const candidates = await candidateBranches(tx, plan, input.quantity);

      if (!candidates.ok) {
        return candidates;
      }

      let reserved: { branchId: string; stockAfter: number } | null = null;

      for (const branchId of candidates.data) {
        const stockAfter = await reserveProductStock(tx, {
          productId: plan.productId,
          branchId,
          quantity: input.quantity,
        });

        if (stockAfter !== null) {
          reserved = { branchId, stockAfter };
          break;
        }
      }

      if (!reserved) {
        return svcFail("OUT_OF_STOCK", "Product stock is insufficient");
      }

      const order = await tx.order.create({
        data: {
          type: OrderType.PRODUCT,
          title: plan.title,
          status: OrderStatus.PENDING,
          amountCents: plan.amountCents,
          customerId: input.customerId,
          businessId: plan.businessId,
          branchId: reserved.branchId,
          productId: plan.productId,
          quantity: input.quantity,
          fulfillmentMethod: plan.target.method,
          stockHeldQty: input.quantity,
          ...(plan.target.method === FulfillmentMethod.DELIVERY
            ? {
                deliveryAddressLine: plan.target.addressLine,
                deliveryLatitude: plan.target.latitude,
                deliveryLongitude: plan.target.longitude,
              }
            : {}),
        },
        select: { id: true },
      });

      await recordStockMovement(tx, {
        productId: plan.productId,
        branchId: reserved.branchId,
        type: StockMovementType.RESERVE,
        quantity: -input.quantity,
        stockAfter: reserved.stockAfter,
        orderId: order.id,
        actorUserId: input.customerId,
      });

      // After the RESERVE row so the ledger's `stockAfter` stays sequential.
      const replacedIntents = await replaceOldestOpenOrders(tx, {
        customerId: input.customerId,
        keepOrderId: order.id,
        now,
      });

      return svcOk({ orderId: order.id, replacedIntents });
    },
    () => svcFail("CONFLICT", "Product checkout conflicted"),
  );
}

/**
 * Direct product purchase (M3-W2 + F10). The customer picks DELIVERY (own
 * address; the nearest ACTIVE delivery-enabled branch with stock ships it)
 * or PICKUP (a chosen ACTIVE pickup-enabled, geocoded branch). The units are
 * reserved with the PENDING order (D10-4) and released by the cancel paths
 * or the expiry cron. Idempotent per product × quantity × fulfillment: a
 * retry reuses the open PENDING order and its PaymentIntent (D10-7). Only
 * marketplace-visible businesses sell (L6), and a customer keeps at most
 * `MAX_OPEN_PRODUCT_ORDERS_PER_CUSTOMER` open orders (M4).
 */
export async function createProductCheckoutIntent(
  deps: CustomerCheckoutDeps,
  input: ProductCheckoutInput,
): Promise<ServiceResult<CheckoutIntentResult, ProductCheckoutErrorCode>> {
  const product = await deps.db.product.findFirst({
    where: {
      id: input.productId,
      status: ProductStatus.PUBLISHED,
      business: marketplaceBusinessWhere,
    },
    select: {
      id: true,
      name: true,
      priceCents: true,
      businessId: true,
      stocks: { select: productBranchStockSelect },
    },
  });

  if (!product) {
    return svcFail("NOT_FOUND", "Product not found");
  }

  let target: DeliveryTarget;

  if (input.fulfillmentMethod === FulfillmentMethod.DELIVERY) {
    if (!input.addressId) {
      return svcFail("VALIDATION_ERROR", "DELIVERY requires an address");
    }

    const address = await deps.db.address.findFirst({
      where: { id: input.addressId, userId: input.customerId },
      select: { addressLine: true, latitude: true, longitude: true },
    });

    if (!address) {
      return svcFail("NOT_FOUND", "Address not found");
    }

    // Early answer from the snapshot; the transaction re-ranks (L8).
    const ranking = rankDeliveryBranches(product.stocks, input.quantity, {
      latitude: address.latitude,
      longitude: address.longitude,
    });

    if (!ranking.ok) {
      return svcFail(ranking.code, "No branch can deliver this order");
    }

    target = {
      method: FulfillmentMethod.DELIVERY,
      addressLine: address.addressLine,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  } else {
    if (!input.branchId) {
      return svcFail("VALIDATION_ERROR", "PICKUP requires a branch");
    }

    const branch = await deps.db.branch.findFirst({
      where: {
        id: input.branchId,
        businessId: product.businessId,
        status: BranchStatus.ACTIVE,
        pickupEnabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true },
    });

    if (!branch) {
      return svcFail("PICKUP_NOT_AVAILABLE", "Pickup branch not available");
    }

    const selection = validatePickupBranch(
      product.stocks,
      branch.id,
      input.quantity,
    );

    if (!selection.ok) {
      // A pickup branch that does not carry the product has no units.
      return svcFail(
        selection.code === "PICKUP_NOT_AVAILABLE"
          ? "OUT_OF_STOCK"
          : selection.code,
        "Pickup branch cannot fulfil this order",
      );
    }

    target = { method: FulfillmentMethod.PICKUP, branchId: selection.branchId };
  }

  const amountCents = product.priceCents * input.quantity;

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid product checkout amount");
  }

  const pending = await findOrCreatePendingOrder(deps, input, {
    productId: product.id,
    title: product.name,
    businessId: product.businessId,
    amountCents,
    target,
  });

  if (!pending.ok) {
    return pending;
  }

  for (const replaced of pending.data.replacedIntents) {
    await voidIntentsAfterClose(deps.stripe, {
      orderId: replaced.orderId,
      intentIds: replaced.intentIds,
    });
  }

  return createOrderPaymentIntent(deps, {
    customerId: input.customerId,
    orderId: pending.data.orderId,
    expectedType: OrderType.PRODUCT,
  });
}
