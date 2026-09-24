import type { UserRole } from "@generated/prisma";

/**
 * The three panels that ship an assistant. The area decides the tool catalog,
 * the system prompt and the conversation scope; it is always derived from the
 * session role, never from client input.
 */
export const AGENT_AREAS = ["business", "corporate", "admin"] as const;

export type AgentArea = (typeof AGENT_AREAS)[number];

const AREA_BY_ROLE: Partial<Record<UserRole, AgentArea>> = {
  BUSINESS: "business",
  CORPORATE: "corporate",
  ADMIN: "admin",
};

export function agentAreaForRole(role: UserRole): AgentArea | null {
  return AREA_BY_ROLE[role] ?? null;
}

export const AGENT_AREA_PATH: Record<AgentArea, string> = {
  business: "/dashboard/assistant",
  corporate: "/corporate/assistant",
  admin: "/admin/assistant",
};

export function isAgentArea(value: string): value is AgentArea {
  return (AGENT_AREAS as readonly string[]).includes(value);
}
