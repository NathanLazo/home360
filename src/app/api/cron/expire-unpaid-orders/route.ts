import { env } from "~/env";
import { db } from "~/server/db";
import { expireUnpaidOrders } from "~/server/services/orders/expire-unpaid-orders";
import { getStripe } from "~/server/services/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// F10 review L10: the batch makes bounded Stripe calls (8 s each) under a
// 40 s run budget; `hasMore` in the body says another run should continue.
export const maxDuration = 60;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${env.CRON_SECRET}`;
}

/**
 * D10-5: same contract as `cron/release-escrow` (Bearer `CRON_SECRET`, GET
 * or POST). Cancels PENDING orders past `unpaidOrderTtlMinutes` with
 * PAYMENT_EXPIRED and expires requests past `expiresAt`. Idempotent: every
 * write is a CAS, so overlapping runs never double-cancel or double-restore.
 */
async function handleExpireUnpaidOrders(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("unauthorized", {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const result = await expireUnpaidOrders({ db, resolveStripe: getStripe });

    if (!result.ok) {
      console.error("[cron/expire-unpaid-orders] EXPIRY_BATCH_FAILED", {
        code: result.code,
      });

      return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
    }

    return Response.json(result.data, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("[cron/expire-unpaid-orders] EXPIRY_BATCH_FAILED", {
      code: "UNEXPECTED_ERROR",
    });

    return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleExpireUnpaidOrders(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleExpireUnpaidOrders(request);
}
