import "server-only";

import { AiUsageSettlement, Prisma } from "@generated/prisma";
import { getAgentModel, type AgentModelId } from "~/lib/agent/agent-models";
import {
  gatewayCostUsdMicros,
  turnCostUsdMicros,
  type TokenUsage,
} from "~/lib/agent/agent-pricing";
import type { AiBillingDb, AiBillingTenant } from "./tenant";

export type RecordAiUsageInput = {
  tenant: AiBillingTenant;
  userId: string;
  conversationId: string | null;
  /** Id of the assistant message that closed the turn. */
  messageId: string;
  modelId: AgentModelId;
  usage: TokenUsage;
};

export type RecordedAiUsage = {
  costUsdMicros: number;
  settlement: AiUsageSettlement;
  balanceUsdMicros: number;
};

/**
 * Writes the ledger row and debits the wallet in one transaction. Idempotent
 * on `messageId`: a retried stream that reports the same message twice does
 * not charge twice. The wallet is clamped at zero (prepaid only, no debt).
 */
export async function recordAiUsage(
  db: AiBillingDb,
  input: RecordAiUsageInput,
): Promise<RecordedAiUsage> {
  const model = getAgentModel(input.modelId);
  const settlement =
    input.tenant.kind === "internal"
      ? AiUsageSettlement.INTERNAL
      : model.free
        ? AiUsageSettlement.FREE
        : AiUsageSettlement.PREPAID;
  const costUsdMicros = turnCostUsdMicros(input.modelId, input.usage);
  const gatewayCost = gatewayCostUsdMicros(input.modelId, input.usage);
  const tenantColumns =
    input.tenant.kind === "business"
      ? { businessId: input.tenant.businessId }
      : input.tenant.kind === "corporate"
        ? { corporateAccountId: input.tenant.corporateAccountId }
        : {};

  try {
    await db.aiUsage.create({
      data: {
        ...tenantColumns,
        userId: input.userId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        model: input.modelId,
        inputTokens: Math.max(0, Math.floor(input.usage.inputTokens)),
        outputTokens: Math.max(0, Math.floor(input.usage.outputTokens)),
        costUsdMicros,
        gatewayCostUsdMicros: gatewayCost,
        settlement,
      },
      select: { id: true },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Already recorded for this message: report the wallet, charge nothing.
      return {
        costUsdMicros,
        settlement,
        balanceUsdMicros: await readBalance(db, input.tenant),
      };
    }

    throw error;
  }

  if (settlement !== AiUsageSettlement.PREPAID || costUsdMicros === 0) {
    return {
      costUsdMicros,
      settlement,
      balanceUsdMicros: await readBalance(db, input.tenant),
    };
  }

  const balanceUsdMicros = await debitWallet(db, input.tenant, costUsdMicros);

  return { costUsdMicros, settlement, balanceUsdMicros };
}

async function readBalance(
  db: AiBillingDb,
  tenant: AiBillingTenant,
): Promise<number> {
  switch (tenant.kind) {
    case "business": {
      const row = await db.business.findUnique({
        where: { id: tenant.businessId },
        select: { aiCreditUsdMicros: true },
      });
      return row?.aiCreditUsdMicros ?? 0;
    }
    case "corporate": {
      const row = await db.corporateAccount.findUnique({
        where: { id: tenant.corporateAccountId },
        select: { aiCreditUsdMicros: true },
      });
      return row?.aiCreditUsdMicros ?? 0;
    }
    case "internal":
      return 0;
  }
}

/**
 * Debits up to `amount`, never below zero. Two statements inside a
 * transaction: the decrement is bounded by the current balance read under the
 * same transaction, so concurrent turns cannot push the wallet negative.
 */
async function debitWallet(
  db: AiBillingDb,
  tenant: AiBillingTenant,
  amount: number,
): Promise<number> {
  return db.$transaction(async (tx) => {
    switch (tenant.kind) {
      case "business": {
        const row = await tx.business.findUniqueOrThrow({
          where: { id: tenant.businessId },
          select: { aiCreditUsdMicros: true },
        });
        const next = Math.max(0, row.aiCreditUsdMicros - amount);
        await tx.business.update({
          where: { id: tenant.businessId },
          data: { aiCreditUsdMicros: next },
          select: { id: true },
        });
        return next;
      }
      case "corporate": {
        const row = await tx.corporateAccount.findUniqueOrThrow({
          where: { id: tenant.corporateAccountId },
          select: { aiCreditUsdMicros: true },
        });
        const next = Math.max(0, row.aiCreditUsdMicros - amount);
        await tx.corporateAccount.update({
          where: { id: tenant.corporateAccountId },
          data: { aiCreditUsdMicros: next },
          select: { id: true },
        });
        return next;
      }
      case "internal":
        return 0;
    }
  });
}
