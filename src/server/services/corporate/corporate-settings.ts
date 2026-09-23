import "server-only";

import type { CorporateTier, PrismaClient } from "@generated/prisma";

import { fail, ok, type TrpcResponse } from "~/server/api/contract";

export type CorporateSettings = {
  companyName: string;
  taxId: string | null;
  tier: CorporateTier;
  owner: { name: string | null; email: string | null; hasPassword: boolean };
  accountManager: { name: string | null; email: string | null } | null;
};

/**
 * Account file for `/corporate/settings` (workstream D). Company name and RFC
 * are negotiated terms edited by the admin (spec/09 §5 `admin.corporate`), so
 * the portal shows them read-only; only the owner's password is self-served.
 */
export async function getCorporateSettings(
  db: PrismaClient,
  corporateAccountId: string,
): Promise<TrpcResponse<CorporateSettings>> {
  const account = await db.corporateAccount.findUnique({
    where: { id: corporateAccountId },
    select: {
      name: true,
      taxId: true,
      tier: true,
      owner: { select: { name: true, email: true, passwordHash: true } },
      accountManager: { select: { name: true, email: true } },
    },
  });

  if (!account) {
    return fail("NOT_FOUND", 404, "Corporate account not found");
  }

  return ok(
    {
      companyName: account.name,
      taxId: account.taxId,
      tier: account.tier,
      owner: {
        name: account.owner.name,
        email: account.owner.email,
        hasPassword: account.owner.passwordHash !== null,
      },
      accountManager: account.accountManager,
    },
    "Corporate settings loaded",
  );
}
