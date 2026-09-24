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

/** Profile page of the area (F9-01); the wallet lives in its billing card. */
export const AGENT_PROFILE_PATH: Record<AgentArea, string> = {
  business: "/dashboard/settings/profile",
  corporate: "/corporate/settings/profile",
  admin: "/admin/settings/profile",
};

export function agentProfileBillingHref(area: AgentArea): string {
  return `${AGENT_PROFILE_PATH[area]}#billing`;
}

export function isAgentArea(value: string): value is AgentArea {
  return (AGENT_AREAS as readonly string[]).includes(value);
}
