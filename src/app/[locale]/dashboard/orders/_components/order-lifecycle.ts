import type { OrderDetail } from "./order.types";

export type OrderNextStep =
  | "awaitingPayment"
  | "acceptProduct"
  | "assignWorker"
  | "serviceScheduled"
  | "inProgress"
  | "shipping"
  | "preparePickup"
  | "outForDelivery"
  | "readyForPickup"
  | "pickedUp"
  | "awaitingCustomerConfirmation"
  | "completed"
  | "cancelled"
  | "disputed";

/**
 * The one action the sheet promotes as its primary (metal) CTA. Everything
 * else the server allows renders as outline/ghost.
 */
export type OrderPrimaryAction =
  | "acceptProduct"
  | "markDelivered"
  | "markReadyForPickup"
  | "redeemPickup"
  | "assignWorker"
  | null;

type EventType = OrderDetail["events"][number]["type"];

function hasEvent(order: OrderDetail, type: EventType): boolean {
  return order.events.some((event) => event.type === type);
}

/**
 * A confirmation request is open while no rework request came after it
 * (worker finish → rework → finish again re-arms it).
 */
function awaitingConfirmation(order: OrderDetail): boolean {
  const last = order.events
    .filter(
      (event) =>
        event.type === "CONFIRMATION_REQUESTED" ||
        event.type === "REWORK_REQUESTED",
    )
    .at(-1);

  return last?.type === "CONFIRMATION_REQUESTED";
}

/**
 * Copy-only hint of where the order stands. Which buttons render never comes
 * from here: the server computes `order.actions` (web and mobile share it).
 */
export function getOrderNextStep(order: OrderDetail): OrderNextStep {
  switch (order.status) {
    case "PENDING":
      return "awaitingPayment";
    case "PAID":
      if (order.type === "PRODUCT") return "acceptProduct";
      return order.worker ? "serviceScheduled" : "assignWorker";
    case "IN_PROGRESS":
      return awaitingConfirmation(order)
        ? "awaitingCustomerConfirmation"
        : "inProgress";
    case "SHIPPING":
      if (order.fulfillmentMethod === "PICKUP") {
        if (order.pickedUpAt !== null || hasEvent(order, "PICKED_UP")) {
          return "pickedUp";
        }
        return hasEvent(order, "READY_FOR_PICKUP")
          ? "readyForPickup"
          : "preparePickup";
      }
      if (hasEvent(order, "DELIVERED")) return "awaitingCustomerConfirmation";
      return hasEvent(order, "OUT_FOR_DELIVERY")
        ? "outForDelivery"
        : "shipping";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "DISPUTED":
      return "disputed";
  }
}

/** Picks the server-allowed action that moves the order forward. */
export function getOrderPrimaryAction(order: OrderDetail): OrderPrimaryAction {
  const { actions } = order;

  if (actions.acceptProduct) return "acceptProduct";
  if (actions.markDelivered) return "markDelivered";
  if (actions.markReadyForPickup) return "markReadyForPickup";
  if (actions.redeemPickup) return "redeemPickup";
  if (actions.assignWorker && order.worker === null) return "assignWorker";
  return null;
}

/** Cancelling a paid order issues a full refund (copy of the dialog). */
export function cancelRefunds(order: OrderDetail): boolean {
  return order.status === "PAID";
}
