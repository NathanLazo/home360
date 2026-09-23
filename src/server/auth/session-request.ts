import "server-only";

import { cookies, headers } from "next/headers";

import {
  DEVICE_COOKIE_NAME,
  baseCookieOptions,
  SESSION_INTENT_COOKIE_NAME,
  parseDeviceId,
  parseSessionIntent,
  type SessionIntent,
} from "./session-cookies";
import { clientIpFromHeaders } from "~/server/services/auth/rate-limit";
import {
  normalizeRequestMetadata,
  type WebSessionRequestMetadata,
} from "~/server/services/auth/web-session";

/**
 * Reads device id, user agent and client IP of the current request. Only
 * callable where `next/headers` is available (route handlers and server
 * components), which covers every path that runs the Node `jwt` callback.
 */
export async function readSessionRequestMetadata(): Promise<WebSessionRequestMetadata> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const ip = clientIpFromHeaders(headerStore);

  return normalizeRequestMetadata({
    deviceId: parseDeviceId(cookieStore.get(DEVICE_COOKIE_NAME)?.value),
    userAgent: headerStore.get("user-agent"),
    ip: ip === "unknown" ? null : ip,
  });
}

/** Intent the login page stored before starting the Google round trip. */
export async function readSessionIntentCookie(): Promise<SessionIntent | null> {
  const cookieStore = await cookies();
  return parseSessionIntent(cookieStore.get(SESSION_INTENT_COOKIE_NAME)?.value);
}

/**
 * One-shot: the intent is dropped once a session is created. Cookie writes are
 * only allowed in route handlers; elsewhere the short max-age expires it.
 */
export async function clearSessionIntentCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    // `__Host-` cookies are only overwritten with the same Secure/path flags.
    cookieStore.set(SESSION_INTENT_COOKIE_NAME, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
  } catch {
    // Not in a mutable cookie context.
  }
}
