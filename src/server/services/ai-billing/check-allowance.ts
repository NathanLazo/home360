import "server-only";

import { getAgentModel, type AgentModelId } from "~/lib/agent/agent-models";
import type { AiBillingDb, AiBillingTenant } from "./tenant";
import { ensureWelcomeCredit } from "./tenant";

export type AiAllowance =
  | { allowed: true; balanceUsdMicros: number }
  | { allowed: false; code: "AI_CREDIT_REQUIRED"; balanceUsdMicros: number };

/**
 * Prepaid-only rule (owner decision): a paid model needs a positive wallet
 * before the turn starts. Free models and internal (admin) usage always pass.
 * The turn itself may overdraw by at most one turn; `recordUsage` clamps the
 * wallet at zero, which is the accepted rounding cost of streaming.
 */
export async function checkAiAllowance(
  db: AiBillingDb,
  input: { tenant: AiBillingTenant; modelId: AgentModelId },
): Promise<AiAllowance> {
  const model = getAgentModel(input.modelId);

  if (model.free || input.tenant.kind === "internal") {
    return { allowed: true, balanceUsdMicros: 0 };
  }

  const balanceUsdMicros = await ensureWelcomeCredit(db, input.tenant);

  if (balanceUsdMicros > 0) {
    return { allowed: true, balanceUsdMicros };
  }

  return { allowed: false, code: "AI_CREDIT_REQUIRED", balanceUsdMicros };
}
