import type { OrderDetail } from "./order.types";

export type OrderNextStep =
  | "awaitingPayment"
  | "acceptProduct"
  | "assignWorker"
  | "serviceScheduled"
  | "inProgress"
  | "shipping"
  | "completed"
  | "cancelled"
  | "disputed";

export type OrderAvailableActions = {
  accept: boolean;
  cancel: boolean;
  /** Cancelling a paid order issues a full refund. */
  cancelRefunds: boolean;
  assignWorker: boolean;
};

const ASSIGNABLE_STATUSES: ReadonlyArray<OrderDetail["status"]> = [
  "PENDING",
  "PAID",
  "IN_PROGRESS",
];

/**
 * Mirrors the server guards of order.acceptProduct / cancel / assignWorker so
 * the sheet only offers what can succeed. The server stays the authority.
 */
export function getOrderActions(order: OrderDetail): OrderAvailableActions {
  const paidRefundable =
    order.status === "PAID" &&
    (order.payment?.status === "IN_ESCROW" ||
      order.payment?.status === "REFUNDING");

  return {
    accept: order.type === "PRODUCT" && order.status === "PAID",
    cancel: order.status === "PENDING" || paidRefundable,
    cancelRefunds: paidRefundable,
    assignWorker:
      order.type === "SERVICE" && ASSIGNABLE_STATUSES.includes(order.status),
  };
}

export function getOrderNextStep(order: OrderDetail): OrderNextStep {
  switch (order.status) {
    case "PENDING":
      return "awaitingPayment";
    case "PAID":
      if (order.type === "PRODUCT") return "acceptProduct";
      return order.worker ? "serviceScheduled" : "assignWorker";
    case "IN_PROGRESS":
      return "inProgress";
    case "SHIPPING":
      return "shipping";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "DISPUTED":
      return "disputed";
  }
}
