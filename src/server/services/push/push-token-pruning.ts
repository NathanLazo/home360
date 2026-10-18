import "server-only";

import type { PrismaClient } from "@generated/prisma";

/** True when Expo reports the device token as permanently invalid. */
export function deviceIsNotRegistered(receipt: {
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

export async function removeTokens(
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
