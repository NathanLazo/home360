import "server-only";

import {
  BranchStatus,
  BusinessStatus,
  FulfillmentMethod,
  OrderStatus,
  OrderType,
  PaymentStatus,
  ProductStatus,
  type Prisma,
} from "@generated/prisma";

import {
  productBranchStockSelect,
  selectDeliveryBranch,
  validatePickupBranch,
} from "~/server/services/catalog/product-availability";
import { reserveProductStock } from "~/server/services/orders/stock-hold";
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
const MILLISECONDS_PER_MINUTE = 60_000;
const DEFAULT_UNPAID_ORDER_TTL_MINUTES = 30;

export type ProductCheckoutErrorCode =
  | "BUSINESS_NOT_ACTIVE"
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
  branchId: string;
  amountCents: number;
  target: DeliveryTarget;
};

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
 * Finds the customer's open PENDING order for the same product, quantity and
 * fulfillment (D10-7) or creates one, reserving the stock atomically in the
 * same Serializable transaction (D10-4). Returns the order id or the stable
 * OUT_OF_STOCK code.
 */
async function findOrCreatePendingOrder(
  deps: Pick<CustomerCheckoutDeps, "db">,
  input: ProductCheckoutInput,
  plan: PendingOrderPlan,
): Promise<ServiceResult<{ orderId: string }, "OUT_OF_STOCK">> {
  const settings = await deps.db.platformSettings.findUnique({
    where: { id: 1 },
    select: { unpaidOrderTtlMinutes: true },
  });
  const ttlMinutes =
    settings?.unpaidOrderTtlMinutes ?? DEFAULT_UNPAID_ORDER_TTL_MINUTES;
  const freshSince = new Date(
    Date.now() - ttlMinutes * MILLISECONDS_PER_MINUTE,
  );

  return runSerializable<ServiceResult<{ orderId: string }, "OUT_OF_STOCK">>(
    deps.db,
    async (tx) => {
      const existing = await tx.order.findFirst({
        where: {
          customerId: input.customerId,
          type: OrderType.PRODUCT,
          status: OrderStatus.PENDING,
          productId: plan.productId,
          quantity: input.quantity,
          fulfillmentMethod: plan.target.method,
          createdAt: { gt: freshSince },
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
        return svcOk({ orderId: existing.id });
      }

      const reserved = await reserveProductStock(tx, {
        productId: plan.productId,
        branchId: plan.branchId,
        quantity: input.quantity,
      });

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
          branchId: plan.branchId,
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

      return svcOk({ orderId: order.id });
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
 * retry reuses the open PENDING order and its PaymentIntent (D10-7).
 */
export async function createProductCheckoutIntent(
  deps: CustomerCheckoutDeps,
  input: ProductCheckoutInput,
): Promise<ServiceResult<CheckoutIntentResult, ProductCheckoutErrorCode>> {
  const product = await deps.db.product.findFirst({
    where: {
      id: input.productId,
      status: ProductStatus.PUBLISHED,
      business: { status: BusinessStatus.ACTIVE },
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
  let branchId: string;

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

    const selection = selectDeliveryBranch(product.stocks, input.quantity, {
      latitude: address.latitude,
      longitude: address.longitude,
    });

    if (!selection.ok) {
      return svcFail(selection.code, "No branch can deliver this order");
    }

    branchId = selection.branchId;
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

    branchId = selection.branchId;
    target = { method: FulfillmentMethod.PICKUP, branchId };
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
    branchId,
    amountCents,
    target,
  });

  if (!pending.ok) {
    return pending;
  }

  return createOrderPaymentIntent(deps, {
    customerId: input.customerId,
    orderId: pending.data.orderId,
    expectedType: OrderType.PRODUCT,
  });
}
