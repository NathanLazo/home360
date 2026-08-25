import "server-only";

import Expo, {
  type ExpoPushMessage,
  type ExpoPushReceiptId,
} from "expo-server-sdk";

import type { PrismaClient } from "../../../../generated/prisma";

export type PushDeepLink =
  | `home360app://request/${string}`
  | `home360app://orders/${string}`
  | `home360app://conversation/${string}`
  | "home360app://team";

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

function deviceIsNotRegistered(receipt: {
  status: "ok" | "error";
  details?: { error?: string } | object;
}): boolean {
  return (
    receipt.status === "error" &&
    receipt.details !== undefined &&
    "error" in receipt.details &&
    receipt.details.error === "DeviceNotRegistered"
  );
}

async function removeTokens(
  db: PrismaClient,
  tokens: ReadonlySet<string>,
): Promise<number> {
  if (tokens.size === 0) {
    return 0;
  }

  const deleted = await db.pushToken.deleteMany({
    where: { expoToken: { in: [...tokens] } },
  });

  return deleted.count;
}

/**
 * Sends one localized notification to every Expo device registered by a user.
 * Delivery is best-effort so a push provider outage never rolls back the
 * domain operation that produced the notification.
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

    const receiptIds = [...receiptTokens.keys()];

    for (const chunk of expo.chunkPushNotificationReceiptIds(receiptIds)) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const token = receiptTokens.get(receiptId);

        if (token && deviceIsNotRegistered(receipt)) {
          deadTokens.add(token);
        }
      }
    }
  } catch {
    console.error("[push] EXPO_DELIVERY_FAILED", { userId });
  }

  const removed = await removeTokens(db, deadTokens);

  return { sent, removed };
}
