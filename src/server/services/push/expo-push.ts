import "server-only";

import Expo, {
  type ExpoPushMessage,
  type ExpoPushReceiptId,
} from "expo-server-sdk";

import type { PrismaClient } from "@generated/prisma";

import { queuePushReceipts } from "./push-receipts";
import { deviceIsNotRegistered, removeTokens } from "./push-token-pruning";

export type PushDeepLink =
  | `home360app://request/${string}`
  | `home360app://orders/${string}`
  | `home360app://conversation/${string}`
  | "home360app://team"
  // Generic landing for broadcast campaigns with no specific target.
  | "home360app://home";

export type PushNotification = {
  title: string;
  body: string;
  url: PushDeepLink;
};

export type PushDeliveryResult = {
  sent: number;
  removed: number;
};

const expo = new Expo();

/**
 * Sends one localized notification to every Expo device registered by a user.
 * Delivery is best-effort so a push provider outage never rolls back the
 * domain operation that produced the notification. Ticket errors prune dead
 * tokens now; receipt errors are pruned later by `cron/push-receipts`.
 */
export async function sendPushToUser(
  db: PrismaClient,
  userId: string,
  notification: PushNotification,
): Promise<PushDeliveryResult> {
  const registeredTokens = await db.pushToken.findMany({
    where: { userId },
    select: { expoToken: true },
  });
  const validTokens = registeredTokens
    .map(({ expoToken }) => expoToken)
    .filter((expoToken) => Expo.isExpoPushToken(expoToken));

  if (validTokens.length === 0) {
    return { sent: 0, removed: 0 };
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    data: { url: notification.url },
  }));
  const receiptTokens = new Map<ExpoPushReceiptId, string>();
  const deadTokens = new Set<string>();
  let sent = 0;

  try {
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        const message = chunk[index];
        const token = typeof message?.to === "string" ? message.to : undefined;

        if (!token) {
          return;
        }

        if (ticket.status === "ok") {
          sent += 1;
          receiptTokens.set(ticket.id, token);
        } else if (deviceIsNotRegistered(ticket)) {
          deadTokens.add(token);
        }
      });
    }

    // Receipts are not ready right after sending; cron/push-receipts reads them.
    await queuePushReceipts(db, receiptTokens);
  } catch {
    console.error("[push] EXPO_DELIVERY_FAILED", { userId });
  }

  const removed = await removeTokens(db, deadTokens);

  return { sent, removed };
}

/**
 * Broadcast variant for admin campaigns: one notification to an arbitrary
 * set of Expo tokens, sent in Expo-sized chunks. Same best-effort contract as
 * `sendPushToUser`: ticket errors prune dead tokens now and receipts are
 * queued for `cron/push-receipts`.
 */
export async function sendPushToTokens(
  db: PrismaClient,
  tokens: readonly string[],
  notification: PushNotification,
): Promise<PushDeliveryResult> {
  const validTokens = [...new Set(tokens)].filter((token) =>
    Expo.isExpoPushToken(token),
  );

  if (validTokens.length === 0) {
    return { sent: 0, removed: 0 };
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    data: { url: notification.url },
  }));
  const receiptTokens = new Map<ExpoPushReceiptId, string>();
  const deadTokens = new Set<string>();
  let sent = 0;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        const message = chunk[index];
        const token = typeof message?.to === "string" ? message.to : undefined;

        if (!token) {
          return;
        }

        if (ticket.status === "ok") {
          sent += 1;
          receiptTokens.set(ticket.id, token);
        } else if (deviceIsNotRegistered(ticket)) {
          deadTokens.add(token);
        }
      });
    } catch {
      // One failed chunk never aborts the rest of the broadcast.
      console.error("[push] EXPO_BROADCAST_CHUNK_FAILED", {
        size: chunk.length,
      });
    }
  }

  await queuePushReceipts(db, receiptTokens);
  const removed = await removeTokens(db, deadTokens);

  return { sent, removed };
}
