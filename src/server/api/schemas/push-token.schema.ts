import { z } from "zod";

import { PushPlatform } from "../../../../generated/prisma";

/**
 * Shared Zod schemas for the push token endpoints (M1-W1). The router
 * validates with these and the app reuses the same input types through the
 * type-only `@home360/api` alias.
 */
export const registerPushTokenSchema = z.object({
  /** Expo push token, e.g. `ExponentPushToken[xxxx]`. Unique per device. */
  expoToken: z.string().trim().min(10).max(200),
  platform: z.nativeEnum(PushPlatform),
  deviceName: z.string().trim().min(1).max(100).optional(),
});

export const unregisterPushTokenSchema = z.object({
  expoToken: z.string().trim().min(10).max(200),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type UnregisterPushTokenInput = z.infer<
  typeof unregisterPushTokenSchema
>;
