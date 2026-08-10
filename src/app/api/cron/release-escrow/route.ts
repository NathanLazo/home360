import { env } from "~/env";
import { db } from "~/server/db";
import { releaseDuePayments } from "~/server/services/payments/escrow";
import { getStripe } from "~/server/services/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${env.CRON_SECRET}`;
}

async function handleReleaseEscrow(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("unauthorized", {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  const result = await releaseDuePayments({ db, stripe: getStripe() });

  if (!result.ok) {
    console.error("[cron/release-escrow] RELEASE_BATCH_FAILED", {
      code: result.code,
    });

    return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
  }

  return Response.json(result.data, { headers: NO_STORE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  return handleReleaseEscrow(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleReleaseEscrow(request);
}
