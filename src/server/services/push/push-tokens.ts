import type { PrismaClient } from "../../../../generated/prisma";
import type {
  RegisterPushTokenInput,
  UnregisterPushTokenInput,
} from "~/server/api/schemas/push-token.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";

/**
 * Idempotent upsert keyed by `expoToken` (M1-W1). A device keeps a single
 * token, so when another account signs in on the same device the row is
 * reassigned to the new `userId` — push must never reach the previous
 * account. Every call refreshes `lastSeenAt` for later pruning (M7-W1).
 */
export const registerPushToken = async (
  db: PrismaClient,
  userId: string,
  input: RegisterPushTokenInput,
): Promise<TrpcResponse<{ id: string }>> => {
  try {
    const token = await db.pushToken.upsert({
      where: { expoToken: input.expoToken },
      create: {
        userId,
        expoToken: input.expoToken,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
      },
      update: {
        userId,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });

    return ok({ id: token.id }, "Push token registered");
  } catch (error: unknown) {
    const { code, status } = normalizeError(error);
    return fail(code, status, "Push token registration failed");
  }
};

/**
 * Deletes the token only when it belongs to the session user; someone else's
 * token (or an unknown one) is a silent no-op, so the response never reveals
 * whether the token exists.
 */
export const unregisterPushToken = async (
  db: PrismaClient,
  userId: string,
  input: UnregisterPushTokenInput,
): Promise<TrpcResponse<null>> => {
  try {
    await db.pushToken.deleteMany({
      where: { expoToken: input.expoToken, userId },
    });

    return ok(null, "Push token unregistered");
  } catch (error: unknown) {
    const { code, status } = normalizeError(error);
    return fail(code, status, "Push token unregistration failed");
  }
};
