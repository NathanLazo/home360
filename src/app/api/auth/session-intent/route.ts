import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  SESSION_INTENT_COOKIE_MAX_AGE_SECONDS,
  SESSION_INTENT_COOKIE_NAME,
  baseCookieOptions,
  parseDeviceId,
  sessionIntentSchema,
} from "~/server/auth/session-cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ intent: sessionIntentSchema });

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Called by the login page right before `signIn()`. Ensures this browser has
 * a stable device id (so a re-login on the same computer replaces its own
 * session silently) and records the user's intent for the Google round trip,
 * where the form body cannot carry it. Same-origin only.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(null, { status: 403, headers: NO_STORE });
  }

  const parsed = bodySchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) {
    return NextResponse.json(null, { status: 400, headers: NO_STORE });
  }

  const cookieStore = await cookies();

  if (!parseDeviceId(cookieStore.get(DEVICE_COOKIE_NAME)?.value)) {
    cookieStore.set(DEVICE_COOKIE_NAME, randomUUID(), {
      ...baseCookieOptions,
      maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    });
  }

  cookieStore.set(SESSION_INTENT_COOKIE_NAME, parsed.data.intent, {
    ...baseCookieOptions,
    maxAge: SESSION_INTENT_COOKIE_MAX_AGE_SECONDS,
  });

  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
