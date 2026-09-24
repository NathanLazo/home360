import "server-only";

import type { Prisma, PrismaClient } from "@generated/prisma";
import {
  DEFAULT_AGENT_MODEL_ID,
  isAgentModelId,
  type AgentModelId,
} from "~/lib/agent/agent-models";

const deviceSelect = {
  id: true,
  platform: true,
  deviceName: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.PushTokenSelect;

export type ProfileDevice = Prisma.PushTokenGetPayload<{
  select: typeof deviceSelect;
}>;

export type ProfileSummary = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Prisma.UserGetPayload<{ select: { role: true } }>["role"];
  locale: string;
  createdAt: Date;
  hasPassword: boolean;
  /** OAuth providers linked to the account ("google"). */
  linkedProviders: string[];
  agentDefaultModel: AgentModelId;
  devices: ProfileDevice[];
};

/**
 * Everything the profile screen shows about the session user. The select is
 * explicit so `passwordHash` and OAuth tokens never leave the server: only
 * their presence is reported.
 */
export async function getProfileSummary(
  db: PrismaClient,
  userId: string,
): Promise<ProfileSummary | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      locale: true,
      createdAt: true,
      passwordHash: true,
      agentDefaultModel: true,
      accounts: { select: { provider: true } },
      pushTokens: {
        orderBy: { lastSeenAt: "desc" },
        select: deviceSelect,
      },
    },
  });

  if (!user) {
    return null;
  }

  const { passwordHash, accounts, agentDefaultModel, pushTokens, ...rest } =
    user;

  return {
    ...rest,
    devices: pushTokens,
    hasPassword: passwordHash !== null,
    linkedProviders: [...new Set(accounts.map((account) => account.provider))],
    agentDefaultModel:
      agentDefaultModel && isAgentModelId(agentDefaultModel)
        ? agentDefaultModel
        : DEFAULT_AGENT_MODEL_ID,
  };
}
