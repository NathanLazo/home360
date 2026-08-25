import "server-only";

import { getTranslations } from "next-intl/server";

import type { PrismaClient } from "../../../../generated/prisma";
import {
  sendPushToUser,
  type PushDeepLink,
  type PushDeliveryResult,
} from "./expo-push";

export type PushMessageKey =
  | "requestNearby"
  | "quoteReceived"
  | "escrowHeld"
  | "orderEnRoute"
  | "orderArrived"
  | "newMessage"
  | "confirmationRequested"
  | "deliveryConfirmed"
  | "escrowAutoReleased"
  | "workerInvitation";

export type LocalizedPushInput = {
  message: PushMessageKey;
  url: PushDeepLink;
};

function normalizeLocale(locale: string): "es" | "en" {
  return locale === "en" ? "en" : "es";
}

/** Builds copy in the destination user's persisted locale and sends it. */
export async function sendLocalizedPushToUser(
  db: PrismaClient,
  userId: string,
  input: LocalizedPushInput,
): Promise<PushDeliveryResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });

    if (!user) {
      return { sent: 0, removed: 0 };
    }

    const t = await getTranslations({
      locale: normalizeLocale(user.locale),
      namespace: `push.${input.message}`,
    });

    return await sendPushToUser(db, userId, {
      title: t("title"),
      body: t("body"),
      url: input.url,
    });
  } catch {
    console.error("[push] LOCALIZED_DELIVERY_FAILED", { userId });
    return { sent: 0, removed: 0 };
  }
}
