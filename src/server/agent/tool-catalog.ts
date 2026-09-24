import type { ToolSet } from "ai";

import type { AgentArea } from "~/lib/agent/agent-area";
import {
  EMPTY_ATTACHMENT_STORE,
  type AgentAttachmentStore,
} from "./agent-attachments";
import type { AgentCaller } from "./tool-runtime";
import { createAdminTools } from "./tools/admin-tools";
import { createBusinessTools } from "./tools/business-tools";
import { createCorporateTools } from "./tools/corporate-tools";

/**
 * One catalog per area. The area comes from the session role, so a business
 * owner can never see an admin tool, not even its name. Tool authorization is
 * still re-checked by the tRPC procedures on every call. Only the admin
 * catalog consumes the chat attachments (payment receipt registration).
 */
export function createAgentTools(
  area: AgentArea,
  caller: AgentCaller,
  attachments: AgentAttachmentStore = EMPTY_ATTACHMENT_STORE,
): ToolSet {
  switch (area) {
    case "business":
      return createBusinessTools(caller);
    case "corporate":
      return createCorporateTools(caller);
    case "admin":
      return createAdminTools(caller, attachments);
  }
}
