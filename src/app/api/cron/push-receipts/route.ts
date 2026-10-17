import { env } from "~/env";
import { db } from "~/server/db";
import { checkPushReceipts } from "~/server/services/push/push-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Same contract as `cron/release-escrow`: Bearer `CRON_SECRET`, GET or POST,
 * idempotent. Reads Expo receipts queued by the push senders and prunes
 * `DeviceNotRegistered` tokens (P-WEB-01).
 */
async function handlePushReceipts(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("unauthorized", {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const result = await checkPushReceipts({ db });

    if (!result.ok) {
      console.error("[cron/push-receipts] RECEIPT_BATCH_FAILED", {
        code: result.code,
      });

      return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
    }

    return Response.json(result.data, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("[cron/push-receipts] RECEIPT_BATCH_FAILED", {
      code: "UNEXPECTED_ERROR",
    });

    return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handlePushReceipts(request);
}

export async function POST(request: Request): Promise<Response> {
  return handlePushReceipts(request);
}
