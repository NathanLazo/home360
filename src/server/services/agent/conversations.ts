import "server-only";

import type { AgentArea as PrismaAgentArea, Prisma, PrismaClient } from "@generated/prisma";
import type { AgentArea } from "~/lib/agent/agent-area";
import { svcFail, svcOk, type ServiceResult } from "~/server/services/service-result";

const AREA_TO_PRISMA: Record<AgentArea, PrismaAgentArea> = {
  business: "BUSINESS",
  corporate: "CORPORATE",
  admin: "ADMIN",
};

/** Newest threads first; the menu never needs more than this. */
const CONVERSATION_LIST_LIMIT = 100;

const summarySelect = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgentConversationSelect;

export type AgentConversationSummary = Prisma.AgentConversationGetPayload<{
  select: typeof summarySelect;
}>;

export type AgentConversationDetail = AgentConversationSummary & {
  messages: Prisma.JsonValue;
};

type Scope = {
  userId: string;
  area: AgentArea;
};

/**
 * Threads are private to their owner and to the panel they were opened in:
 * both filters live in the query, so a stale id from another area is a plain
 * NOT_FOUND.
 */
export async function listAgentConversations(
  db: PrismaClient,
  scope: Scope,
): Promise<AgentConversationSummary[]> {
  return db.agentConversation.findMany({
    where: { userId: scope.userId, area: AREA_TO_PRISMA[scope.area] },
    orderBy: { updatedAt: "desc" },
    take: CONVERSATION_LIST_LIMIT,
    select: summarySelect,
  });
}

export async function getAgentConversation(
  db: PrismaClient,
  scope: Scope,
  id: string,
): Promise<ServiceResult<AgentConversationDetail, "NOT_FOUND">> {
  const conversation = await db.agentConversation.findFirst({
    where: { id, userId: scope.userId, area: AREA_TO_PRISMA[scope.area] },
    select: { ...summarySelect, messages: true },
  });

  if (!conversation) {
    return svcFail("NOT_FOUND");
  }

  return svcOk(conversation);
}

export async function createAgentConversation(
  db: PrismaClient,
  scope: Scope,
  input: { title: string; messages: Prisma.InputJsonValue },
): Promise<AgentConversationSummary> {
  return db.agentConversation.create({
    data: {
      userId: scope.userId,
      area: AREA_TO_PRISMA[scope.area],
      title: input.title,
      messages: input.messages,
    },
    select: summarySelect,
  });
}

export async function updateAgentConversation(
  db: PrismaClient,
  scope: Scope,
  input: { id: string; title?: string; messages?: Prisma.InputJsonValue },
): Promise<ServiceResult<AgentConversationSummary, "NOT_FOUND">> {
  const { count } = await db.agentConversation.updateMany({
    where: {
      id: input.id,
      userId: scope.userId,
      area: AREA_TO_PRISMA[scope.area],
    },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.messages !== undefined ? { messages: input.messages } : {}),
    },
  });

  if (count === 0) {
    return svcFail("NOT_FOUND");
  }

  const conversation = await db.agentConversation.findUniqueOrThrow({
    where: { id: input.id },
    select: summarySelect,
  });

  return svcOk(conversation);
}

export async function deleteAgentConversation(
  db: PrismaClient,
  scope: Scope,
  id: string,
): Promise<ServiceResult<{ id: string }, "NOT_FOUND">> {
  const { count } = await db.agentConversation.deleteMany({
    where: { id, userId: scope.userId, area: AREA_TO_PRISMA[scope.area] },
  });

  if (count === 0) {
    return svcFail("NOT_FOUND");
  }

  return svcOk({ id });
}
