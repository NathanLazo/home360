import type { UserRole } from "@generated/prisma";

/**
 * The web panels that ship an assistant. They own a screen, a profile and a
 * wallet, so every web map (paths, workspace links) is keyed by this union.
 */
export const PANEL_AGENT_AREAS = ["business", "corporate", "admin"] as const;

export type PanelAgentArea = (typeof PANEL_AGENT_AREAS)[number];

/**
 * Every assistant area. `customer` is the mobile concierge (Don Víctor): it
 * has a tool catalog, a prompt and a conversation scope, but no web panel.
 * The area decides the tool catalog, the system prompt and the conversation
 * scope; it is always derived from the session role, never from client input.
 */
export const AGENT_AREAS = [...PANEL_AGENT_AREAS, "customer"] as const;

export type AgentArea = (typeof AGENT_AREAS)[number];

const AREA_BY_ROLE: Partial<Record<UserRole, AgentArea>> = {
  BUSINESS: "business",
  CORPORATE: "corporate",
  ADMIN: "admin",
  CUSTOMER: "customer",
};

/** Assistant area of a role (web panels and the mobile customer concierge). */
export function agentAreaForRole(role: UserRole): AgentArea | null {
  return AREA_BY_ROLE[role] ?? null;
}

export function isPanelAgentArea(area: AgentArea): area is PanelAgentArea {
  return (PANEL_AGENT_AREAS as readonly string[]).includes(area);
}

/** Web panel of a role; customers and workers live in the mobile app. */
export function panelAreaForRole(role: UserRole): PanelAgentArea | null {
  const area = agentAreaForRole(role);
  return area && isPanelAgentArea(area) ? area : null;
}

export const AGENT_AREA_PATH: Record<PanelAgentArea, string> = {
  business: "/dashboard/assistant",
  corporate: "/corporate/assistant",
  admin: "/admin/assistant",
};

/** Profile page of the area (F9-01); the wallet lives in its billing card. */
export const AGENT_PROFILE_PATH: Record<PanelAgentArea, string> = {
  business: "/dashboard/settings/profile",
  corporate: "/corporate/settings/profile",
  admin: "/admin/settings/profile",
};

export function agentProfileBillingHref(area: PanelAgentArea): string {
  return `${AGENT_PROFILE_PATH[area]}#billing`;
}

export function isAgentArea(value: string): value is AgentArea {
  return (AGENT_AREAS as readonly string[]).includes(value);
}
