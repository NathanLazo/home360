import { z } from "zod";

/**
 * Cookies that support the single-active-session flow. Both are httpOnly and
 * never carry authority on their own: the device id only decides whether a
 * re-login on the same browser can replace its own session silently, and the
 * intent only records that the user confirmed "use this device" before an
 * OAuth round trip (credentials send the intent in the form body instead).
 */
const secureCookies = process.env.NODE_ENV === "production";

export const DEVICE_COOKIE_NAME = secureCookies
  ? "__Host-home360.device"
  : "home360.device";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const SESSION_INTENT_COOKIE_NAME = secureCookies
  ? "__Host-home360.session-intent"
  : "home360.session-intent";
export const SESSION_INTENT_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export const baseCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: secureCookies,
} as const;

export const sessionIntentSchema = z.enum(["keep", "replace"]);
export type SessionIntent = z.infer<typeof sessionIntentSchema>;

const deviceIdSchema = z.string().uuid();

export function parseDeviceId(value: string | undefined): string | null {
  const parsed = deviceIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseSessionIntent(
  value: string | undefined,
): SessionIntent | null {
  const parsed = sessionIntentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
