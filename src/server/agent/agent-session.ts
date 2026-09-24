import "server-only";

import type { Session } from "next-auth";

import type { PrismaClient } from "@generated/prisma";
import { agentAreaForRole, type AgentArea } from "~/lib/agent/agent-area";
import { resolveSession } from "~/server/auth/resolve-session";

export type AgentSession = {
  session: Session;
  area: AgentArea;
};

/**
 * Session guard of the assistant: a valid session whose role owns an area.
 * Customers and workers get `null` (they have no web panel). Impersonation
 * passes through: tRPC keeps every mutation refused, and the prompt says so.
 */
export async function resolveAgentSession(
  headers: Headers,
): Promise<AgentSession | null> {
  const session = await resolveSession(headers);

  if (!session) {
    return null;
  }

  const area = agentAreaForRole(session.user.role);

  if (!area) {
    return null;
  }

  return { session, area };
}

/**
 * Display name of the tenant for the prompt. One indexed lookup; a missing
 * row (should not happen behind the role guards) simply yields no name.
 */
export async function resolveAgentTenantName(
  db: PrismaClient,
  agentSession: AgentSession,
): Promise<string | null> {
  const ownerId = agentSession.session.user.id;

  switch (agentSession.area) {
    case "business": {
      const business = await db.business.findUnique({
        where: { ownerId },
        select: { name: true },
      });
      return business?.name ?? null;
    }
    case "corporate": {
      const account = await db.corporateAccount.findUnique({
        where: { ownerId },
        select: { name: true },
      });
      return account?.name ?? null;
    }
    case "admin":
      return null;
  }
}
