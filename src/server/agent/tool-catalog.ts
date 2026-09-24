import type { ToolSet } from "ai";

import type { AgentArea } from "~/lib/agent/agent-area";
import type { AgentCaller } from "./tool-runtime";
import { createAdminTools } from "./tools/admin-tools";
import { createBusinessTools } from "./tools/business-tools";
import { createCorporateTools } from "./tools/corporate-tools";

/**
 * One catalog per area. The area comes from the session role, so a business
 * owner can never see an admin tool, not even its name. Tool authorization is
 * still re-checked by the tRPC procedures on every call.
 */
export function createAgentTools(
  area: AgentArea,
  caller: AgentCaller,
): ToolSet {
  switch (area) {
    case "business":
      return createBusinessTools(caller);
    case "corporate":
      return createCorporateTools(caller);
    case "admin":
      return createAdminTools(caller);
  }
}
