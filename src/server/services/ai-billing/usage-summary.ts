import "server-only";

import type { Prisma } from "@generated/prisma";
import { AGENT_MODELS } from "~/lib/agent/agent-models";
import { listAiCreditPacks, type AiCreditPack } from "./credit-packs";
import { ensureWelcomeCredit, tenantWhere, type AiBillingDb, type AiBillingTenant } from "./tenant";

export type AiModelUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  turns: number;
};

export type AiBillingSummary = {
  /** `internal` for admins: no wallet, ledger only. */
  mode: "wallet" | "internal";
  balanceUsdMicros: number;
  monthUsage: AiModelUsage[];
  packs: AiCreditPack[];
};

const usageRowSelect = {
  id: true,
  createdAt: true,
  model: true,
  inputTokens: true,
  outputTokens: true,
  costUsdMicros: true,
  settlement: true,
  conversationId: true,
} satisfies Prisma.AiUsageSelect;

export type AiUsageRow = Prisma.AiUsageGetPayload<{
  select: typeof usageRowSelect;
}>;

const purchaseRowSelect = {
  id: true,
  createdAt: true,
  paidAt: true,
  packCode: true,
  amountUsdCents: true,
  creditUsdMicros: true,
  status: true,
} satisfies Prisma.AiCreditPurchaseSelect;

export type AiPurchaseRow = Prisma.AiCreditPurchaseGetPayload<{
  select: typeof purchaseRowSelect;
}>;

function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Rows of the user for admins, rows of the tenant otherwise. */
function ledgerWhere(
  tenant: AiBillingTenant,
  userId: string,
): Prisma.AiUsageWhereInput {
  return tenantWhere(tenant) ?? { userId };
}

export async function getAiBillingSummary(
  db: AiBillingDb,
  input: { tenant: AiBillingTenant; userId: string },
): Promise<AiBillingSummary> {
  const balanceUsdMicros =
    input.tenant.kind === "internal"
      ? 0
      : await ensureWelcomeCredit(db, input.tenant);

  const grouped = await db.aiUsage.groupBy({
    by: ["model"],
    where: {
      ...ledgerWhere(input.tenant, input.userId),
      createdAt: { gte: monthStart() },
    },
    _sum: { inputTokens: true, outputTokens: true, costUsdMicros: true },
    _count: { _all: true },
  });

  const byModel = new Map(grouped.map((row) => [row.model, row]));
  const monthUsage: AiModelUsage[] = AGENT_MODELS.map((model) => {
    const row = byModel.get(model.id);
    return {
      model: model.id,
      inputTokens: row?._sum.inputTokens ?? 0,
      outputTokens: row?._sum.outputTokens ?? 0,
      costUsdMicros: row?._sum.costUsdMicros ?? 0,
      turns: row?._count._all ?? 0,
    };
  });

  return {
    mode: input.tenant.kind === "internal" ? "internal" : "wallet",
    balanceUsdMicros,
    monthUsage,
    packs: input.tenant.kind === "internal" ? [] : listAiCreditPacks(),
  };
}

export async function listAiUsage(
  db: AiBillingDb,
  input: {
    tenant: AiBillingTenant;
    userId: string;
    cursor: string | null;
    limit: number;
  },
): Promise<{ items: AiUsageRow[]; nextCursor: string | null }> {
  const rows = await db.aiUsage.findMany({
    where: ledgerWhere(input.tenant, input.userId),
    orderBy: { createdAt: "desc" },
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: usageRowSelect,
  });

  const items = rows.slice(0, input.limit);
  const nextCursor =
    rows.length > input.limit ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

export async function listAiPurchases(
  db: AiBillingDb,
  input: { tenant: AiBillingTenant; limit: number },
): Promise<AiPurchaseRow[]> {
  const where = tenantWhere(input.tenant);

  if (!where) {
    return [];
  }

  return db.aiCreditPurchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: input.limit,
    select: purchaseRowSelect,
  });
}
