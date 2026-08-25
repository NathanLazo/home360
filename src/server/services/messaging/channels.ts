import "server-only";

/**
 * Private channel names (M4-W1). Only these two families exist; the channel
 * auth endpoint (`/api/pusher/auth`) authorizes both by participation.
 */

/** Chat channel of one conversation. */
export function conversationChannel(conversationId: string): string {
  return `private-conversation-${conversationId}`;
}

/** Tracking channel of one order (C6, M4-W2). */
export function orderChannel(orderId: string): string {
  return `private-order-${orderId}`;
}
