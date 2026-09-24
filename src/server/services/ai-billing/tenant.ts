import "server-only";

import type { PrismaClient } from "@generated/prisma";
import type { AgentArea } from "~/lib/agent/agent-area";
import { AI_WELCOME_CREDIT_USD_MICROS } from "~/lib/agent/agent-pricing";

/**
 * Who pays for the assistant. Business and corporate owners pay from their
 * tenant wallet; admins are internal (no wallet, no charge).
 */
export type AiBillingTenant =
  | { kind: "business"; businessId: string }
  | { kind: "corporate"; corporateAccountId: string }
  | { kind: "internal" };

export type AiBillingDb = Pick<
  PrismaClient,
  "business" | "corporateAccount" | "aiUsage" | "aiCreditPurchase" | "$transaction"
>;

/** Resolves the wallet owner of a panel session by area and owner id. */
export async function resolveAiBillingTenant(
  db: AiBillingDb,
  input: { area: AgentArea; userId: string },
): Promise<AiBillingTenant | null> {
  switch (input.area) {
    case "business": {
      const business = await db.business.findUnique({
        where: { ownerId: input.userId },
        select: { id: true },
      });
      return business ? { kind: "business", businessId: business.id } : null;
    }
    case "corporate": {
      const account = await db.corporateAccount.findUnique({
        where: { ownerId: input.userId },
        select: { id: true },
      });
      return account
        ? { kind: "corporate", corporateAccountId: account.id }
        : null;
    }
    case "admin":
      return { kind: "internal" };
  }
}

/**
 * Grants the one-time welcome credit. Conditional write on the null mark, so
 * concurrent first requests never grant it twice. Returns the current wallet.
 */
export async function ensureWelcomeCredit(
  db: AiBillingDb,
  tenant: AiBillingTenant,
): Promise<number> {
  const now = new Date();

  switch (tenant.kind) {
    case "business": {
      await db.business.updateMany({
        where: { id: tenant.businessId, aiWelcomeCreditAt: null },
        data: {
          aiWelcomeCreditAt: now,
          aiCreditUsdMicros: { increment: AI_WELCOME_CREDIT_USD_MICROS },
        },
      });
      const business = await db.business.findUnique({
        where: { id: tenant.businessId },
        select: { aiCreditUsdMicros: true },
      });
      return business?.aiCreditUsdMicros ?? 0;
    }
    case "corporate": {
      await db.corporateAccount.updateMany({
        where: { id: tenant.corporateAccountId, aiWelcomeCreditAt: null },
        data: {
          aiWelcomeCreditAt: now,
          aiCreditUsdMicros: { increment: AI_WELCOME_CREDIT_USD_MICROS },
        },
      });
      const account = await db.corporateAccount.findUnique({
        where: { id: tenant.corporateAccountId },
        select: { aiCreditUsdMicros: true },
      });
      return account?.aiCreditUsdMicros ?? 0;
    }
    case "internal":
      return 0;
  }
}

/** Prisma `where` fragment that scopes usage/purchase rows to the tenant. */
export function tenantWhere(
  tenant: AiBillingTenant,
): { businessId: string } | { corporateAccountId: string } | null {
  switch (tenant.kind) {
    case "business":
      return { businessId: tenant.businessId };
    case "corporate":
      return { corporateAccountId: tenant.corporateAccountId };
    case "internal":
      return null;
  }
}
