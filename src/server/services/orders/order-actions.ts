import {
  FulfillmentMethod,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
} from "@generated/prisma";

/** Order states in which the technician can still be (re)assigned. */
const ASSIGNABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
];

/**
 * Fulfillment method as the lifecycle sees it: PRODUCT orders created before
 * F10 have no stored method and always shipped to the address snapshot, so
 * they behave as DELIVERY. SERVICE orders have none.
 */
export function effectiveFulfillmentMethod(
  type: OrderType,
  method: FulfillmentMethod | null,
): FulfillmentMethod | null {
  if (type !== OrderType.PRODUCT) {
    return null;
  }

  return method ?? FulfillmentMethod.DELIVERY;
}

export type BusinessOrderActionInput = {
  type: OrderType;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  paymentStatus: PaymentStatus | null;
  hasDispute: boolean;
  pickedUpAt: Date | null;
  events: readonly { type: OrderEventType }[];
};

/**
 * Business-side affordances of an order (D10-2, `order.getById.actions`).
 * Mirrors the preconditions of acceptProduct, the fulfillment services,
 * assignWorker and cancel so web and mobile render the same buttons; every
 * mutation re-validates them under its own transaction.
 */
export function getBusinessOrderActions(input: BusinessOrderActionInput) {
  const hasEvent = (type: OrderEventType) =>
    input.events.some((event) => event.type === type);
  const isProduct = input.type === OrderType.PRODUCT;
  const escrowHeld =
    input.paymentStatus === PaymentStatus.IN_ESCROW && !input.hasDispute;
  const shipping = isProduct && input.status === OrderStatus.SHIPPING;
  const method = effectiveFulfillmentMethod(
    input.type,
    input.fulfillmentMethod,
  );
  const delivery = method === FulfillmentMethod.DELIVERY;
  const pickup = method === FulfillmentMethod.PICKUP;
  const delivered = hasEvent(OrderEventType.DELIVERED);
  const readyForPickup = hasEvent(OrderEventType.READY_FOR_PICKUP);

  return {
    acceptProduct: isProduct && input.status === OrderStatus.PAID && escrowHeld,
    markOutForDelivery:
      shipping &&
      delivery &&
      !delivered &&
      !hasEvent(OrderEventType.OUT_FOR_DELIVERY),
    markDelivered: shipping && delivery && !delivered && escrowHeld,
    markReadyForPickup: shipping && pickup && !readyForPickup,
    redeemPickup:
      shipping &&
      pickup &&
      readyForPickup &&
      input.pickedUpAt === null &&
      escrowHeld,
    assignWorker:
      input.type === OrderType.SERVICE &&
      ASSIGNABLE_ORDER_STATUSES.includes(input.status),
    cancel:
      (input.status === OrderStatus.PENDING &&
        (input.paymentStatus === null ||
          input.paymentStatus === PaymentStatus.PENDING)) ||
      (input.status === OrderStatus.PAID &&
        (input.paymentStatus === PaymentStatus.IN_ESCROW ||
          input.paymentStatus === PaymentStatus.REFUNDING)),
  };
}
