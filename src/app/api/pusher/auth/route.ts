import { z } from "zod";

import { fail, type TrpcResponse } from "~/server/api/contract";
import { resolveSession } from "~/server/auth/resolve-session";
import { db } from "~/server/db";
import {
  isConversationParticipant,
  isOrderParticipant,
} from "~/server/services/messaging/participants";
import { getPusherServer } from "~/server/services/messaging/pusher-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * pusher-js posts `application/x-www-form-urlencoded` with `socket_id` and
 * `channel_name`. Only the two private channel families exist:
 * `private-conversation-{id}` (chat, M4-W1) and `private-order-{id}`
 * (tracking, M4-W2). Anything else never reaches the authorizers.
 */
const bodySchema = z.object({
  socket_id: z.string().regex(/^[\d.]+$/),
  channel_name: z
    .string()
    .regex(/^private-(conversation|order)-[a-z0-9]+$/),
});

function respond(body: TrpcResponse<unknown>): Response {
  return Response.json(body, {
    status: body.status,
    headers: NO_STORE_HEADERS,
  });
}

/**
 * Channel auth for Pusher private channels. Session comes from the NextAuth
 * cookie or the mobile Bearer token (M0-W2) through the shared
 * `resolveSession` helper. A non-participant answers the same generic
 * NOT_FOUND as the tRPC procedures, never revealing whether the resource
 * exists.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const pusher = getPusherServer();

    if (!pusher) {
      // Without envs the chat runs in polling-only mode; the client should
      // not even try to connect, but a stray attempt fails cleanly.
      return respond(
        fail("INTERNAL_ERROR", 503, "Realtime is not configured"),
      );
    }

    const session = await resolveSession(request.headers);

    if (!session?.user) {
      return respond(fail("UNAUTHORIZED", 401, "Sign in to continue"));
    }

    const form = await request.formData();
    const parsed = bodySchema.safeParse({
      socket_id: form.get("socket_id"),
      channel_name: form.get("channel_name"),
    });

    if (!parsed.success) {
      return respond(fail("VALIDATION_ERROR", 422, "Invalid channel request"));
    }

    const { socket_id: socketId, channel_name: channelName } = parsed.data;
    const userId = session.user.id;

    const authorized = channelName.startsWith("private-conversation-")
      ? await isConversationParticipant(
          db,
          userId,
          channelName.slice("private-conversation-".length),
        )
      : await isOrderParticipant(
          db,
          userId,
          channelName.slice("private-order-".length),
        );

    if (!authorized) {
      return respond(fail("NOT_FOUND", 404, "Channel not found"));
    }

    // pusher-js expects the raw `{ auth }` object, not the TrpcResponse
    // envelope.
    const auth = pusher.authorizeChannel(socketId, channelName);

    return Response.json(auth, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[pusher/auth] CHANNEL_AUTH_FAILED", error);
    return respond(fail("INTERNAL_ERROR", 500, "Channel auth failed"));
  }
}
