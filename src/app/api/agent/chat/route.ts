import { createAgentUIStreamResponse, validateUIMessages } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { isAgentModelId } from "~/lib/agent/agent-models";
import type { TokenUsage } from "~/lib/agent/agent-pricing";
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
import { checkAiAllowance } from "~/server/services/ai-billing/check-allowance";
import { recordAiUsage } from "~/server/services/ai-billing/record-usage";
import { resolveAiBillingTenant } from "~/server/services/ai-billing/tenant";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(500),
  model: z.string().optional(),
  locale: z.enum(["es", "en"]).default("es"),
  /** Persisted thread id, when the client already saved the conversation. */
  conversationId: z.string().cuid().nullish(),
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
 * route handler of the feature; everything else (threads, wallet) goes
 * through tRPC. The area comes from the session role, the tools from the
 * area, and every tool call re-enters tRPC with the same session.
 *
 * Billing (F8-05): a paid model requires prepaid balance before the turn
 * starts; the usage reported on `finish` is priced and debited in `onEnd`.
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
    requestedModel && isAgentModelId(requestedModel)
      ? requestedModel
      : AGENT_MODEL;

  const { session, area } = agentSession;
  const tenant = await resolveAiBillingTenant(db, {
    area,
    userId: session.user.id,
  });

  if (!tenant) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const allowance = await checkAiAllowance(db, { tenant, modelId: model });

  if (!allowance.allowed) {
    return NextResponse.json({ error: allowance.code }, { status: 402 });
  }

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

  // Usage arrives on the `finish` part; the ledger row is written once the
  // response message id is known (`onEnd`).
  let turnUsage: TokenUsage | null = null;

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    messageMetadata: ({ part }): AgentMessageMetadata | undefined => {
      if (part.type !== "finish") {
        return undefined;
      }

      turnUsage = {
        inputTokens: part.totalUsage.inputTokens ?? 0,
        outputTokens: part.totalUsage.outputTokens ?? 0,
      };

      return {
        usage: {
          inputTokens: turnUsage.inputTokens,
          outputTokens: turnUsage.outputTokens,
          totalTokens: part.totalUsage.totalTokens ?? 0,
        },
      };
    },
    onEnd: async ({ responseMessage }) => {
      if (!turnUsage) {
        return;
      }

      try {
        await recordAiUsage(db, {
          tenant,
          userId: session.user.id,
          conversationId: parsed.data.conversationId ?? null,
          messageId: responseMessage.id,
          modelId: model,
          usage: turnUsage,
        });
      } catch (error: unknown) {
        // The answer already streamed; a ledger failure must not surface as
        // a chat error. It is logged for reconciliation.
        console.error("[agent] usage not recorded", {
          messageId: responseMessage.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    },
  });
}
