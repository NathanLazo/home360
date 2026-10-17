import "server-only";

import Expo, { type ExpoPushReceiptId } from "expo-server-sdk";

import type { PrismaClient } from "@generated/prisma";

import { svcOk, type ServiceResult } from "../service-result";
import { deviceIsNotRegistered, removeTokens } from "./push-token-pruning";

/** Expo recommends reading receipts ~15 minutes after sending. */
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
/** Expo keeps receipts for 24 hours; older rows can never resolve. */
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
/** Rows per cron run; Expo accepts up to 1 000 ids per request. */
const RECEIPT_BATCH_SIZE = 1_000;

const expo = new Expo();

export type PushReceiptsResult = {
  checked: number;
  removedTokens: number;
  expired: number;
};

/**
 * Stores the ticket ids of a send so `checkPushReceipts` can read their
 * receipts later. Best-effort: a failure only skips receipt-based pruning.
 */
export async function queuePushReceipts(
  db: PrismaClient,
  receiptTokens: ReadonlyMap<ExpoPushReceiptId, string>,
): Promise<void> {
  if (receiptTokens.size === 0) {
    return;
  }

  try {
    await db.pushReceipt.createMany({
      data: [...receiptTokens].map(([receiptId, expoToken]) => ({
        receiptId,
        expoToken,
      })),
      skipDuplicates: true,
    });
  } catch {
    console.error("[push] RECEIPT_QUEUE_FAILED", { count: receiptTokens.size });
  }
}

/**
 * Reads due receipts, prunes `DeviceNotRegistered` tokens and drops every row
 * Expo answered for (or that outlived Expo's 24 h retention). Rows Expo has not
 * answered yet stay for the next run. Idempotent: safe to run on any schedule.
 */
export async function checkPushReceipts(deps: {
  db: PrismaClient;
  now?: Date;
}): Promise<ServiceResult<PushReceiptsResult>> {
  const { db } = deps;
  const now = deps.now ?? new Date();

  const expired = await db.pushReceipt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RECEIPT_TTL_MS) } },
  });

  const due = await db.pushReceipt.findMany({
    where: { createdAt: { lte: new Date(now.getTime() - RECEIPT_DELAY_MS) } },
    orderBy: { createdAt: "asc" },
    take: RECEIPT_BATCH_SIZE,
    select: { receiptId: true, expoToken: true },
  });
  const tokenByReceipt = new Map(
    due.map(({ receiptId, expoToken }) => [receiptId, expoToken]),
  );
  const answered: string[] = [];
  const deadTokens = new Set<string>();

  for (const chunk of expo.chunkPushNotificationReceiptIds([
    ...tokenByReceipt.keys(),
  ])) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      answered.push(receiptId);
      const token = tokenByReceipt.get(receiptId);

      if (token && deviceIsNotRegistered(receipt)) {
        deadTokens.add(token);
      }
    }
  }

  const removedTokens = await removeTokens(db, deadTokens);

  if (answered.length > 0) {
    await db.pushReceipt.deleteMany({ where: { receiptId: { in: answered } } });
  }

  return svcOk({
    checked: answered.length,
    removedTokens,
    expired: expired.count,
  });
}
