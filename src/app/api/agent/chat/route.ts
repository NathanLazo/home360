import { createAgentUIStreamResponse, validateUIMessages } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { isAgentModelId } from "~/lib/agent/agent-models";
import {
  resolveAgentSession,
  resolveAgentTenantName,
} from "~/server/agent/agent-session";
import {
  AGENT_MODEL,
  createHome360Agent,
  type AgentMessageMetadata,
} from "~/server/agent/home360-agent";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(500),
  model: z.string().optional(),
  locale: z.enum(["es", "en"]).default("es"),
});

/** Calendar date in the platform time zone (Chihuahua), for the prompt. */
function todayInPlatformTimeZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chihuahua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Streaming endpoint of the assistant. tRPC batches JSON, so this is the one
 * route handler of the feature; everything else (threads) goes through the
 * `agent` router. The area comes from the session role, the tools from the
 * area, and every tool call re-enters tRPC with the same session.
 */
export async function POST(request: Request) {
  if (!env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }

  const agentSession = await resolveAgentSession(request.headers);

  if (!agentSession) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  let uiMessages;

  try {
    uiMessages = await validateUIMessages({ messages: parsed.data.messages });
  } catch {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const requestedModel = parsed.data.model;
  const model =
    requestedModel && isAgentModelId(requestedModel) ? requestedModel : AGENT_MODEL;

  const { session, area } = agentSession;
  const caller = createCaller({ db, session, headers: request.headers });
  const tenantName = await resolveAgentTenantName(db, agentSession);

  const agent = createHome360Agent({
    area,
    caller,
    model,
    context: {
      area,
      locale: parsed.data.locale,
      userName: session.user.name ?? null,
      tenantName,
      today: todayInPlatformTimeZone(),
      readOnly: session.user.impersonator !== null,
    },
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    messageMetadata: ({ part }): AgentMessageMetadata | undefined => {
      if (part.type !== "finish") {
        return undefined;
      }

      return {
        usage: {
          inputTokens: part.totalUsage.inputTokens ?? 0,
          outputTokens: part.totalUsage.outputTokens ?? 0,
          totalTokens: part.totalUsage.totalTokens ?? 0,
        },
      };
    },
  });
}
