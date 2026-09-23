import { env } from "~/env";
import { db } from "~/server/db";
import { sendDueRatingReminders } from "~/server/services/notifications/rating-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Same contract as `cron/release-escrow`: Bearer `CRON_SECRET`, GET or POST,
 * idempotent per order through `Order.ratingReminderSentAt`. Schedule it
 * hourly next to the escrow release job.
 */
async function handleRatingReminders(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("unauthorized", {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const result = await sendDueRatingReminders({ db });

    if (!result.ok) {
      console.error("[cron/rating-reminders] REMINDER_BATCH_FAILED", {
        code: result.code,
      });

      return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
    }

    return Response.json(result.data, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("[cron/rating-reminders] REMINDER_BATCH_FAILED", {
      code: "UNEXPECTED_ERROR",
    });

    return new Response("error", { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleRatingReminders(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleRatingReminders(request);
}
