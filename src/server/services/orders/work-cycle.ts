import { OrderEventType, OrderStatus } from "@generated/prisma";

type TimelineEvent = { type: OrderEventType };

/**
 * Events of the current work cycle (workstream D). A `REWORK_REQUESTED`
 * restarts the technician's cycle: everything before the last rework is
 * history, so "work done" and "recording started" are evaluated only after it.
 * Callers must pass the events in chronological order.
 */
export function currentCycleEvents<TEvent extends TimelineEvent>(
  events: readonly TEvent[],
): TEvent[] {
  let start = 0;

  events.forEach((event, index) => {
    if (event.type === OrderEventType.REWORK_REQUESTED) {
      start = index + 1;
    }
  });

  return events.slice(start);
}

/** The technician finished the current cycle and asked for confirmation. */
export function isAwaitingConfirmation(
  events: readonly TimelineEvent[],
): boolean {
  return currentCycleEvents(events).some(
    (event) =>
      event.type === OrderEventType.WORK_DONE ||
      event.type === OrderEventType.CONFIRMATION_REQUESTED,
  );
}

/**
 * Order states where the escrow still holds the customer's money for a
 * SERVICE in execution (dispute / rework window).
 */
export const ESCROW_HELD_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
];
