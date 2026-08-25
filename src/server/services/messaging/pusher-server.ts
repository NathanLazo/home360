import "server-only";

import Pusher from "pusher";

import { env } from "~/env";

/**
 * Singleton Pusher Channels server client (M4-W1, consumed by M4-W2 tracking).
 * Persistence is the source of truth; Pusher only notifies. Without the four
 * server envs the platform runs in polling-only mode: `getPusherServer`
 * returns null and callers skip the trigger (logged once, never a crash).
 */
let client: Pusher | null = null;
let warned = false;

export function getPusherServer(): Pusher | null {
  if (client) {
    return client;
  }

  if (
    !env.PUSHER_APP_ID ||
    !env.PUSHER_KEY ||
    !env.PUSHER_SECRET ||
    !env.PUSHER_CLUSTER
  ) {
    if (!warned) {
      warned = true;
      console.warn(
        "[pusher] Missing PUSHER_* envs; realtime events disabled (polling-only mode)",
      );
    }
    return null;
  }

  client = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.PUSHER_CLUSTER,
    useTLS: true,
  });

  return client;
}

/**
 * Fire-and-forget trigger. Realtime is best-effort by design: a Pusher outage
 * must never fail the mutation that already persisted the source of truth.
 */
export async function triggerPusherEvent(
  channels: string[],
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const pusher = getPusherServer();

  if (!pusher || channels.length === 0) {
    return;
  }

  try {
    await pusher.trigger(channels, event, payload);
  } catch (error) {
    console.error("[pusher] trigger failed", { event, error });
  }
}
