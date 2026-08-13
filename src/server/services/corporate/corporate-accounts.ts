import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  CorporateStatus,
  CorporateTier,
  CorporateTierChangeStatus,
  type Prisma,
  SubscriptionStatus,
  UserRole,
  type PrismaClient,
} from "../../../../generated/prisma";
import {
  CORPORATE_PAGE_SIZE,
  type CreateCorporateAccountInput,
  type ListCorporateAccountsInput,
  type UpdateCorporateTermsInput,
} from "~/app/[locale]/admin/corporate/_components/corporate.schema";
import { getPathname } from "~/i18n/navigation";
import type { EmailClient } from "~/server/services/email/email-client";
import { sendCorporateInvitation } from "~/server/services/email/send-corporate-invitation";
import {
  createCorporateBillingSubscription,
  ensureCorporateMonthlyPrice,
  ensureCorporateStripeCustomer,
  findCorporateSubscriptionForMembership,
  pauseCorporateSubscription,
  resumeCorporateSubscription,
  retrieveCorporateSubscription,
  updateCorporateSubscriptionPrice,
  type CorporateBillingDeps,
} from "~/server/services/corporate/corporate-billing";
import { syncCorporateMembershipFromStripe } from "~/server/services/corporate/sync-corporate-membership";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

/**
 * Corporate account administration (F7-03).
 *
 * All money-facing invariants live here: the terms of a tier are validated in
 * one place, `create` never fabricates credentials, every Stripe call happens
 * outside Prisma transactions, and `updateTerms` only affects future orders —
 * `Payment` rows are never rewritten (their commission was frozen at capture,
 * XC-26).
 */

const INVITATION_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export type CorporateDirectoryDeps = { db: PrismaClient };

export type CorporateAccountsDeps = CorporateBillingDeps;

export type CorporateTermsErrorCode = "VALIDATION_ERROR";

export type CreateCorporateAccountErrorCode =
  | "VALIDATION_ERROR"
  | "EMAIL_TAKEN"
  | "EMAIL_DELIVERY_FAILED";

export type ActivateCorporateAccountErrorCode = "PLAN_NOT_SYNCED";

export type UpdateCorporateTermsErrorCode =
  | "VALIDATION_ERROR"
  | "PLAN_NOT_SYNCED";

/**
 * Location ranges per tier (spec/09 §2). The upper bound caps the configured
 * limit; the lower bound only constrains the configuration, never actual
 * usage — a STANDARD account with 2 active locations is perfectly valid.
 */
const TIER_LOCATION_RANGES: Record<
  Exclude<CorporateTier, "CUSTOM">,
  { min: number; max: number }
> = {
  BASIC: { min: 1, max: 3 },
  STANDARD: { min: 4, max: 15 },
  ENTERPRISE: { min: 16, max: 50 },
};

const CUSTOM_MIN_LOCATIONS = 51;
const CUSTOM_MAX_COMMISSION_PCT = 4;

const TIERS_REQUIRING_MANAGER: readonly CorporateTier[] = [
  CorporateTier.STANDARD,
  CorporateTier.ENTERPRISE,
  CorporateTier.CUSTOM,
];

export type ResolvedCorporateTerms = {
  tier: CorporateTier;
  commissionPct: number;
  monthlyFeeCents: number;
  maxLocations: number | null;
  accountManagerId: string | null;
};

/**
 * Validates the negotiated terms against the tier rules and resolves catalog
 * defaults. Explicit overrides are admin-only by construction (the whole
 * namespace is `adminProcedure`) and are logged so they stay auditable.
 */
async function resolveTermsForTier(
  db: PrismaClient,
  input: {
    tier: CorporateTier;
    commissionPct?: number | undefined;
    monthlyFeeCents?: number | undefined;
    maxLocations?: number | null | undefined;
    accountManagerId?: string | null | undefined;
  },
): Promise<ServiceResult<ResolvedCorporateTerms, CorporateTermsErrorCode>> {
  const accountManagerId = input.accountManagerId ?? null;

  if (TIERS_REQUIRING_MANAGER.includes(input.tier) && accountManagerId === null) {
    return svcFail("VALIDATION_ERROR", "Tier requires an account manager");
  }

  if (accountManagerId !== null) {
    const manager = await db.user.findUnique({
      where: { id: accountManagerId },
      select: { role: true },
    });

    if (manager?.role !== UserRole.ADMIN) {
      return svcFail("VALIDATION_ERROR", "Account manager must be an ADMIN user");
    }
  }

  if (input.tier === CorporateTier.CUSTOM) {
    if (
      input.commissionPct === undefined ||
      input.monthlyFeeCents === undefined ||
      input.maxLocations === undefined
    ) {
      return svcFail("VALIDATION_ERROR", "CUSTOM tier requires explicit terms");
    }

    if (
      input.commissionPct < 0 ||
      input.commissionPct > CUSTOM_MAX_COMMISSION_PCT
    ) {
      return svcFail(
        "VALIDATION_ERROR",
        "CUSTOM commission must be between 0 and 4",
      );
    }

    if (input.monthlyFeeCents <= 0) {
      return svcFail("VALIDATION_ERROR", "CUSTOM tier requires a monthly fee");
    }

    if (
      input.maxLocations !== null &&
      input.maxLocations < CUSTOM_MIN_LOCATIONS
    ) {
      return svcFail(
        "VALIDATION_ERROR",
        `CUSTOM location limit must be null or >= ${CUSTOM_MIN_LOCATIONS}`,
      );
    }

    return svcOk({
      tier: input.tier,
      commissionPct: input.commissionPct,
      monthlyFeeCents: input.monthlyFeeCents,
      maxLocations: input.maxLocations,
      accountManagerId,
    });
  }

  const config = await db.corporateTierConfig.findUnique({
    where: { tier: input.tier },
    select: { commissionPct: true, monthlyFeeCents: true, maxLocations: true },
  });

  if (!config) {
    return svcFail("CONFLICT", "Tier catalog is not seeded");
  }
  if (
    config.commissionPct === null ||
    config.monthlyFeeCents === null ||
    config.maxLocations === null
  ) {
    return svcFail("CONFLICT", "Tier catalog is not seeded");
  }

  const commissionPct = input.commissionPct ?? config.commissionPct;
  const monthlyFeeCents = input.monthlyFeeCents ?? config.monthlyFeeCents;
  const maxLocations =
    input.maxLocations === undefined ? config.maxLocations : input.maxLocations;
  const range = TIER_LOCATION_RANGES[input.tier];

  if (maxLocations === null || maxLocations < range.min || maxLocations > range.max) {
    return svcFail(
      "VALIDATION_ERROR",
      `Location limit for ${input.tier} must be between ${range.min} and ${range.max}`,
    );
  }

  if (monthlyFeeCents <= 0) {
    return svcFail("VALIDATION_ERROR", "Monthly fee must be positive");
  }

  const overrides = [
    input.commissionPct !== undefined &&
    input.commissionPct !== config.commissionPct
      ? "commissionPct"
      : null,
    input.monthlyFeeCents !== undefined &&
    input.monthlyFeeCents !== config.monthlyFeeCents
      ? "monthlyFeeCents"
      : null,
    input.maxLocations !== undefined && input.maxLocations !== config.maxLocations
      ? "maxLocations"
      : null,
  ].filter((field) => field !== null);

  if (overrides.length > 0) {
    // Auditable trail for negotiated deviations from the catalog.
    console.warn("[corporate] TIER_TERMS_OVERRIDE", {
      tier: input.tier,
      overrides,
    });
  }

  return svcOk({
    tier: input.tier,
    commissionPct,
    monthlyFeeCents,
    maxLocations,
    accountManagerId,
  });
}

// ---------------------------------------------------------------------------
// Directory (list / getById)
// ---------------------------------------------------------------------------

const accountListSelect = {
  id: true,
  name: true,
  tier: true,
  status: true,
  commissionPct: true,
  monthlyFeeCents: true,
  maxLocations: true,
  createdAt: true,
  owner: { select: { name: true, email: true } },
  accountManager: { select: { name: true } },
  _count: { select: { locations: { where: { isActive: true } } } },
} satisfies Prisma.CorporateAccountSelect;

type AccountListRow = Prisma.CorporateAccountGetPayload<{
  select: typeof accountListSelect;
}>;

export type CorporateAccountCounts = {
  all: number;
  active: number;
  pending: number;
  suspended: number;
  cancelled: number;
};

export type CorporateAccountListItem = {
  id: string;
  name: string;
  tier: CorporateTier;
  status: CorporateStatus;
  commissionPct: number;
  monthlyFeeCents: number;
  maxLocations: number | null;
  activeLocations: number;
  monthSpendCents: number;
  ownerName: string | null;
  ownerEmail: string | null;
  accountManagerName: string | null;
  createdAt: Date;
};

export type CorporateAccountListResult = {
  counts: CorporateAccountCounts;
  nextCursor: string | null;
  items: CorporateAccountListItem[];
};

function startOfCurrentMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Month spend per account: sum of captured payments of the account's orders in
 * the current month. Read from `Payment` — the money ledger — never inferred
 * from order amounts.
 */
async function monthSpendByAccount(
  db: PrismaClient,
  accountIds: string[],
): Promise<Map<string, number>> {
  if (accountIds.length === 0) {
    return new Map();
  }

  const payments = await db.payment.findMany({
    where: {
      createdAt: { gte: startOfCurrentMonth() },
      order: { is: { corporateAccountId: { in: accountIds } } },
    },
    select: {
      amountCents: true,
      order: { select: { corporateAccountId: true } },
    },
  });
  const totals = new Map<string, number>();

  for (const payment of payments) {
    const accountId = payment.order?.corporateAccountId;

    if (accountId) {
      totals.set(accountId, (totals.get(accountId) ?? 0) + payment.amountCents);
    }
  }

  return totals;
}

function buildAccountWhere(
  input: Pick<ListCorporateAccountsInput, "status" | "tier" | "search">,
): Prisma.CorporateAccountWhereInput {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(input.tier ? { tier: input.tier } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { owner: { name: { contains: input.search, mode: "insensitive" } } },
            {
              owner: { email: { contains: input.search, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };
}

async function getAccountCounts(
  db: PrismaClient,
): Promise<CorporateAccountCounts> {
  const grouped = await db.corporateAccount.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus = new Map(
    grouped.map((group) => [group.status, group._count._all]),
  );
  const counts = {
    active: byStatus.get(CorporateStatus.ACTIVE) ?? 0,
    pending: byStatus.get(CorporateStatus.PENDING) ?? 0,
    suspended: byStatus.get(CorporateStatus.SUSPENDED) ?? 0,
    cancelled: byStatus.get(CorporateStatus.CANCELLED) ?? 0,
  };

  return {
    all: counts.active + counts.pending + counts.suspended + counts.cancelled,
    ...counts,
  };
}

export async function listCorporateAccounts(
  deps: CorporateDirectoryDeps,
  input: ListCorporateAccountsInput,
): Promise<ServiceResult<CorporateAccountListResult>> {
  const counts = await getAccountCounts(deps.db);
  const rows = await deps.db.corporateAccount.findMany({
    where: buildAccountWhere(input),
    take: CORPORATE_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: accountListSelect,
  });
  const hasNextPage = rows.length > CORPORATE_PAGE_SIZE;
  const pageRows = hasNextPage ? rows.slice(0, CORPORATE_PAGE_SIZE) : rows;
  const spend = await monthSpendByAccount(
    deps.db,
    pageRows.map((row) => row.id),
  );

  const toItem = (row: AccountListRow): CorporateAccountListItem => ({
    id: row.id,
    name: row.name,
    tier: row.tier,
    status: row.status,
    commissionPct: row.commissionPct,
    monthlyFeeCents: row.monthlyFeeCents,
    maxLocations: row.maxLocations,
    activeLocations: row._count.locations,
    monthSpendCents: spend.get(row.id) ?? 0,
    ownerName: row.owner.name,
    ownerEmail: row.owner.email,
    accountManagerName: row.accountManager?.name ?? null,
    createdAt: row.createdAt,
  });

  return svcOk({
    counts,
    nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
    items: pageRows.map(toItem),
  });
}

const accountDetailSelect = {
  id: true,
  name: true,
  taxId: true,
  tier: true,
  status: true,
  statusReason: true,
  commissionPct: true,
  monthlyFeeCents: true,
  maxLocations: true,
  stripeCustomerId: true,
  createdAt: true,
  owner: { select: { name: true, email: true } },
  accountManager: { select: { id: true, name: true, email: true } },
  membership: {
    select: {
      status: true,
      renewsAt: true,
      stripeSubscriptionId: true,
    },
  },
  locations: {
    orderBy: [{ isActive: "desc" }, { name: "asc" }] as const,
    take: 60,
    select: {
      id: true,
      name: true,
      addressLine: true,
      city: true,
      contactName: true,
      isActive: true,
    },
  },
  orders: {
    take: 10,
    orderBy: { createdAt: "desc" } as const,
    select: {
      id: true,
      folio: true,
      title: true,
      amountCents: true,
      status: true,
      createdAt: true,
      corporateLocation: { select: { name: true } },
    },
  },
  tierChangeRequests: {
    where: { status: CorporateTierChangeStatus.PENDING },
    orderBy: { createdAt: "desc" } as const,
    select: {
      id: true,
      requestedTier: true,
      notes: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      locations: { where: { isActive: true } },
      orders: true,
    },
  },
} satisfies Prisma.CorporateAccountSelect;

type AccountDetailRow = Prisma.CorporateAccountGetPayload<{
  select: typeof accountDetailSelect;
}>;

export type CorporateAccountDetailResult = Omit<
  AccountDetailRow,
  "_count" | "stripeCustomerId" | "membership"
> & {
  activeLocations: number;
  ordersCount: number;
  monthSpendCents: number;
  hasStripeCustomer: boolean;
  membership: {
    status: SubscriptionStatus;
    renewsAt: Date | null;
    hasStripeSubscription: boolean;
  } | null;
};

export async function getCorporateAccountDetail(
  deps: CorporateDirectoryDeps,
  input: { accountId: string },
): Promise<ServiceResult<CorporateAccountDetailResult>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: accountDetailSelect,
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  const spend = await monthSpendByAccount(deps.db, [account.id]);
  const { _count, stripeCustomerId, membership, ...rest } = account;

  return svcOk({
    ...rest,
    activeLocations: _count.locations,
    ordersCount: _count.orders,
    monthSpendCents: spend.get(account.id) ?? 0,
    hasStripeCustomer: stripeCustomerId !== null,
    membership: membership
      ? {
          status: membership.status,
          renewsAt: membership.renewsAt,
          hasStripeSubscription: membership.stripeSubscriptionId !== null,
        }
      : null,
  });
}

// ---------------------------------------------------------------------------
// Create (invitation flow — never generates credentials)
// ---------------------------------------------------------------------------

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Issues the F1-09 secure password link (random token, only the hash is
 * persisted, one hour, single live link) and sends the invitation. Neither the
 * token nor the full email address is ever logged. Returns whether the email
 * actually went out; on failure the token is burned so no dead link survives.
 */
async function issueAndSendInvitation(
  db: PrismaClient,
  emailClient: EmailClient | null,
  appUrl: string,
  input: {
    userId: string;
    email: string;
    companyName: string;
    locale: CreateCorporateAccountInput["locale"];
  },
): Promise<boolean> {
  if (!emailClient) {
    console.error("[corporate] EMAIL_CLIENT_UNAVAILABLE");
    return false;
  }

  const now = new Date();
  const plainToken = randomBytes(32).toString("base64url");
  const token = await db.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: input.userId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    return tx.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(plainToken),
        expiresAt: new Date(now.getTime() + INVITATION_TOKEN_LIFETIME_MS),
      },
      select: { id: true },
    });
  });

  const pathname = getPathname({
    href: "/reset-password",
    locale: input.locale,
  });
  const invitationUrl = new URL(pathname, appUrl);
  invitationUrl.searchParams.set("token", plainToken);

  try {
    await sendCorporateInvitation(emailClient, {
      to: input.email,
      companyName: input.companyName,
      invitationUrl: invitationUrl.toString(),
      locale: input.locale,
    });

    return true;
  } catch {
    await db.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    console.error("[corporate] INVITATION_DELIVERY_FAILED");

    return false;
  }
}

export type CreateCorporateAccountDeps = {
  db: PrismaClient;
  emailClient: EmailClient | null;
  appUrl: string;
};

/**
 * Creates the CORPORATE owner (no `passwordHash` — the agent never fabricates
 * credentials) and the PENDING account in one transaction; the invitation goes
 * out after the commit. Retrying with the same email of a still-pending,
 * never-signed-in account resends the invitation instead of duplicating rows.
 */
export async function createCorporateAccount(
  deps: CreateCorporateAccountDeps,
  input: CreateCorporateAccountInput,
): Promise<ServiceResult<{ id: string }, CreateCorporateAccountErrorCode>> {
  const terms = await resolveTermsForTier(deps.db, input);

  if (!terms.ok) {
    return terms;
  }

  const existingUser = await deps.db.user.findUnique({
    where: { email: input.ownerEmail },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      corporateAccount: { select: { id: true, name: true, status: true } },
    },
  });

  if (existingUser) {
    const pendingAccount =
      existingUser.role === UserRole.CORPORATE &&
      existingUser.passwordHash === null &&
      existingUser.corporateAccount?.status === CorporateStatus.PENDING
        ? existingUser.corporateAccount
        : null;

    if (!pendingAccount) {
      return svcFail("EMAIL_TAKEN", "Email already registered");
    }

    // Idempotent retry of a failed delivery: same user, same account, new
    // invitation. Nothing is duplicated.
    const delivered = await issueAndSendInvitation(
      deps.db,
      deps.emailClient,
      deps.appUrl,
      {
        userId: existingUser.id,
        email: input.ownerEmail,
        companyName: pendingAccount.name,
        locale: input.locale,
      },
    );

    return delivered
      ? svcOk({ id: pendingAccount.id })
      : svcFail("EMAIL_DELIVERY_FAILED", "Corporate invitation was not sent");
  }

  const created = await deps.db.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: input.ownerEmail,
        name: input.name,
        role: UserRole.CORPORATE,
      },
      select: { id: true },
    });

    return tx.corporateAccount.create({
      data: {
        name: input.name,
        taxId: input.taxId ?? null,
        ownerId: owner.id,
        tier: terms.data.tier,
        status: CorporateStatus.PENDING,
        commissionPct: terms.data.commissionPct,
        monthlyFeeCents: terms.data.monthlyFeeCents,
        maxLocations: terms.data.maxLocations,
        accountManagerId: terms.data.accountManagerId,
      },
      select: { id: true, ownerId: true },
    });
  });

  const delivered = await issueAndSendInvitation(
    deps.db,
    deps.emailClient,
    deps.appUrl,
    {
      userId: created.ownerId,
      email: input.ownerEmail,
      companyName: input.name,
      locale: input.locale,
    },
  );

  if (!delivered) {
    // The account stays PENDING on purpose: retrying `create` with the same
    // email resends the invitation without duplicating user or account.
    return svcFail("EMAIL_DELIVERY_FAILED", "Corporate invitation was not sent");
  }

  return svcOk({ id: created.id });
}

// ---------------------------------------------------------------------------
// Activate (Stripe outside every transaction, F5-findings F5-1)
// ---------------------------------------------------------------------------

/**
 * PENDING → ACTIVE with Billing provisioning, in the exact order F5-1 taught:
 *
 * 1. Validate state and load terms with a minimal select.
 * 2. Local idempotent step: ensure the membership row without any Stripe id.
 * 3. Stripe: customer + subscription (F4-03 Portal contract, idempotent keys).
 * 4. Local transaction: persist the subscription id and flip to ACTIVE.
 *
 * A crash after 3 is repaired by retrying: the membership converges through
 * `stripeSubscriptionId @unique` and conditional `updateMany` writes.
 */
export async function activateCorporateAccount(
  deps: CorporateAccountsDeps,
  input: { accountId: string },
): Promise<ServiceResult<{ id: string }, ActivateCorporateAccountErrorCode>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      tier: true,
      monthlyFeeCents: true,
      membership: {
        select: { id: true, stripeSubscriptionId: true },
      },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.status !== CorporateStatus.PENDING) {
    // Reactivation of a SUSPENDED account uses `reactivate`; ACTIVE and
    // CANCELLED cannot be (re)activated here.
    return svcFail("CONFLICT", "Corporate account is not pending");
  }

  // Step 2 — local, idempotent, still without a Stripe id and without ACTIVE.
  const membership =
    account.membership ??
    (await deps.db.corporateMembership.upsert({
      where: { corporateAccountId: account.id },
      create: {
        corporateAccountId: account.id,
        status: SubscriptionStatus.PAST_DUE,
      },
      update: {},
      select: { id: true, stripeSubscriptionId: true },
    }));

  if (membership.stripeSubscriptionId === null) {
    // Step 3 — Stripe, outside any Prisma transaction.
    const price = await ensureCorporateMonthlyPrice(deps, {
      accountId: account.id,
      tier: account.tier,
      monthlyFeeCents: account.monthlyFeeCents,
    });

    if (!price.ok) {
      return price;
    }

    const subscription = await createCorporateBillingSubscription(deps, {
      accountId: account.id,
      membershipId: membership.id,
      tier: account.tier,
      stripePriceId: price.data.stripePriceId,
    });

    if (!subscription.ok) {
      return subscription;
    }

    // Step 4 — persist. `updateMany(... stripeSubscriptionId: null)` and a
    // reread cover the race with a concurrent activation.
    try {
      await deps.db.$transaction(async (tx) => {
        const written = await tx.corporateMembership.updateMany({
          where: { id: membership.id, stripeSubscriptionId: null },
          data: {
            stripeSubscriptionId: subscription.data.stripeSubscriptionId,
            status: subscription.data.status,
            renewsAt: subscription.data.renewsAt,
          },
        });

        if (written.count === 0) {
          const current = await tx.corporateMembership.findUnique({
            where: { id: membership.id },
            select: { stripeSubscriptionId: true },
          });

          if (
            current?.stripeSubscriptionId !==
            subscription.data.stripeSubscriptionId
          ) {
            throw new Error("MEMBERSHIP_CLAIMED_BY_ANOTHER_SUBSCRIPTION");
          }
        }

        await tx.corporateAccount.updateMany({
          where: { id: account.id, status: CorporateStatus.PENDING },
          data: { status: CorporateStatus.ACTIVE, statusReason: null },
        });
      });
    } catch (error) {
      // Recoverable: the remote subscription exists and is logged; retrying
      // `activate` is idempotent through `stripeSubscriptionId @unique`.
      console.error("[corporate] ACTIVATION_PERSIST_FAILED", {
        corporateAccountId: account.id,
        stripeSubscriptionId: subscription.data.stripeSubscriptionId,
        reason: error instanceof Error ? error.message : "UNKNOWN",
      });

      return svcFail("STRIPE_ERROR", "Activation could not be persisted");
    }

    return svcOk({ id: account.id });
  }

  // Repair path: the subscription already exists (previous run crashed after
  // step 3) — just converge the local status.
  await deps.db.corporateAccount.updateMany({
    where: { id: account.id, status: CorporateStatus.PENDING },
    data: { status: CorporateStatus.ACTIVE, statusReason: null },
  });

  return svcOk({ id: account.id });
}

// ---------------------------------------------------------------------------
// Reconcile (F7-07 — repairs an interrupted activation, idempotently)
// ---------------------------------------------------------------------------

export type ReconcileCorporateBillingErrorCode = "PLAN_NOT_SYNCED";

/**
 * Repairs an activation that crashed between the remote Stripe writes and the
 * local persistence, without creating anything that already exists:
 *
 * 1. `ensureCorporateStripeCustomer` returns the persisted customer.
 * 2. The remote subscription is recovered by the persisted id, or — when the
 *    id was never persisted — by listing the customer's subscriptions and
 *    matching the membership metadata (the database already proved the
 *    customer belongs to the account). Only when nothing exists remotely are
 *    Price and Subscription created through the idempotent F7-03 services.
 * 3. `syncCorporateMembershipFromStripe` performs the absolute local write and
 *    a still-PENDING account flips to ACTIVE, exactly like `activate`.
 *
 * A second run finds every object already in place and changes nothing.
 */
export async function reconcileCorporateBilling(
  deps: CorporateAccountsDeps,
  input: { accountId: string },
): Promise<ServiceResult<{ id: string }, ReconcileCorporateBillingErrorCode>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      tier: true,
      monthlyFeeCents: true,
      membership: { select: { id: true, stripeSubscriptionId: true } },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.status === CorporateStatus.CANCELLED) {
    // CANCELLED is terminal (webhook-owned); reviving billing here would
    // contradict the `customer.subscription.deleted` contract.
    return svcFail("CONFLICT", "Cancelled accounts cannot be reconciled");
  }

  if (account.membership === null && account.status === CorporateStatus.PENDING) {
    // Nothing was ever provisioned: there is no interrupted activation to
    // repair, `activate` is the entry point.
    return svcFail("CONFLICT", "Corporate account activation has not started");
  }

  // Local idempotent step, same as activate step 2: the row exists before any
  // Stripe id can be bound to it.
  const membership =
    account.membership ??
    (await deps.db.corporateMembership.upsert({
      where: { corporateAccountId: account.id },
      create: {
        corporateAccountId: account.id,
        status: SubscriptionStatus.PAST_DUE,
      },
      update: {},
      select: { id: true, stripeSubscriptionId: true },
    }));

  let stripeSubscriptionId = membership.stripeSubscriptionId;

  if (stripeSubscriptionId === null) {
    const customer = await ensureCorporateStripeCustomer(deps, {
      accountId: account.id,
    });

    if (!customer.ok) {
      return customer;
    }

    const found = await findCorporateSubscriptionForMembership(deps, {
      accountId: account.id,
      membershipId: membership.id,
      stripeCustomerId: customer.data.stripeCustomerId,
    });

    if (!found.ok) {
      return found;
    }

    if (found.data.subscription !== null) {
      stripeSubscriptionId = found.data.subscription.id;
    } else {
      // Nothing remote either: provision through the same idempotent services
      // `activate` uses, so a concurrent or repeated run converges.
      const price = await ensureCorporateMonthlyPrice(deps, {
        accountId: account.id,
        tier: account.tier,
        monthlyFeeCents: account.monthlyFeeCents,
      });

      if (!price.ok) {
        return price;
      }

      const created = await createCorporateBillingSubscription(deps, {
        accountId: account.id,
        membershipId: membership.id,
        tier: account.tier,
        stripePriceId: price.data.stripePriceId,
      });

      if (!created.ok) {
        return created;
      }

      stripeSubscriptionId = created.data.stripeSubscriptionId;
    }
  }

  // Converge the local row on the authoritative remote object. The sync binds
  // the subscription id, maps the status, refreshes `renewsAt` and stamps
  // `stripeUpdatedAt`, with all the F7-07 guards applied.
  const retrieved = await retrieveCorporateSubscription(deps, {
    accountId: account.id,
    stripeSubscriptionId,
  });

  if (!retrieved.ok) {
    return retrieved;
  }

  const synced = await syncCorporateMembershipFromStripe(
    { db: deps.db },
    { subscription: retrieved.data.subscription, observedAt: new Date() },
  );

  if (!synced.ok) {
    return synced;
  }

  if (synced.data.membershipId === null) {
    // The subscription resolved to no local membership: the remote object
    // belongs to someone else and reconciliation must not guess.
    return svcFail("CONFLICT", "Stripe subscription does not match the account");
  }

  // Same final flip as activate: only a PENDING account becomes ACTIVE, and
  // only while the membership is actually alive.
  const current = await deps.db.corporateMembership.findUnique({
    where: { id: membership.id },
    select: { status: true },
  });

  if (current !== null && current.status !== SubscriptionStatus.CANCELED) {
    await deps.db.corporateAccount.updateMany({
      where: { id: account.id, status: CorporateStatus.PENDING },
      data: { status: CorporateStatus.ACTIVE, statusReason: null },
    });
  }

  return svcOk({ id: account.id });
}

// ---------------------------------------------------------------------------
// Terms (future orders only — Payments are never rewritten)
// ---------------------------------------------------------------------------

class TermsClaimLostError extends Error {}
class RequestClaimLostError extends Error {}

/**
 * Renegotiates the terms of an account. Historical `Payment` rows are never
 * touched: the commission was frozen at capture (XC-26) and only future
 * captures read the new percentage.
 *
 * If the fee/tier of an ACTIVE billed account changes, the single Stripe item
 * rotates to the new Price with `create_prorations` **before** anything is
 * persisted locally, so a Stripe failure leaves the previous local terms
 * intact. When a `requestId` is supplied the matching PENDING tier-change
 * request is approved in the same transaction that persists the terms.
 */
export async function updateCorporateTerms(
  deps: CorporateAccountsDeps,
  input: UpdateCorporateTermsInput & { adminId: string },
): Promise<ServiceResult<{ id: string }, UpdateCorporateTermsErrorCode>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      tier: true,
      monthlyFeeCents: true,
      updatedAt: true,
      membership: { select: { stripeSubscriptionId: true } },
      _count: { select: { locations: { where: { isActive: true } } } },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.status === CorporateStatus.CANCELLED) {
    return svcFail("CONFLICT", "Cancelled accounts cannot be renegotiated");
  }

  const terms = await resolveTermsForTier(deps.db, {
    tier: input.tier,
    commissionPct: input.commissionPct,
    monthlyFeeCents: input.monthlyFeeCents,
    maxLocations: input.maxLocations,
    accountManagerId: input.accountManagerId,
  });

  if (!terms.ok) {
    return terms;
  }

  // The limit can never fall below current active usage.
  if (
    terms.data.maxLocations !== null &&
    terms.data.maxLocations < account._count.locations
  ) {
    return svcFail(
      "VALIDATION_ERROR",
      "Location limit is below the active locations of the account",
    );
  }

  if (input.requestId !== undefined) {
    const request = await deps.db.corporateTierChangeRequest.findFirst({
      where: { id: input.requestId, corporateAccountId: account.id },
      select: { status: true, requestedTier: true },
    });

    if (!request) {
      return svcFail("NOT_FOUND", "Tier change request not found");
    }

    if (request.status !== CorporateTierChangeStatus.PENDING) {
      return svcFail("CONFLICT", "Tier change request is not pending");
    }

    if (request.requestedTier !== terms.data.tier) {
      return svcFail(
        "VALIDATION_ERROR",
        "Approved terms must match the requested tier",
      );
    }
  }

  // Stripe rotation only when an active billed membership changes its fee.
  const stripeSubscriptionId = account.membership?.stripeSubscriptionId ?? null;
  const feeChanged = terms.data.monthlyFeeCents !== account.monthlyFeeCents;

  if (
    stripeSubscriptionId !== null &&
    account.status === CorporateStatus.ACTIVE &&
    feeChanged
  ) {
    const price = await ensureCorporateMonthlyPrice(deps, {
      accountId: account.id,
      tier: terms.data.tier,
      monthlyFeeCents: terms.data.monthlyFeeCents,
    });

    if (!price.ok) {
      return price;
    }

    const rotated = await updateCorporateSubscriptionPrice(deps, {
      accountId: account.id,
      stripeSubscriptionId,
      targetPriceId: price.data.stripePriceId,
      tier: terms.data.tier,
      version: account.updatedAt.getTime(),
    });

    if (!rotated.ok) {
      // Local terms stay exactly as they were.
      return rotated;
    }
  }

  try {
    await deps.db.$transaction(async (tx) => {
      const written = await tx.corporateAccount.updateMany({
        where: { id: account.id, updatedAt: account.updatedAt },
        data: {
          tier: terms.data.tier,
          commissionPct: terms.data.commissionPct,
          monthlyFeeCents: terms.data.monthlyFeeCents,
          maxLocations: terms.data.maxLocations,
          accountManagerId: terms.data.accountManagerId,
        },
      });

      if (written.count === 0) {
        throw new TermsClaimLostError();
      }

      if (input.requestId !== undefined) {
        const approved = await tx.corporateTierChangeRequest.updateMany({
          where: {
            id: input.requestId,
            corporateAccountId: account.id,
            status: CorporateTierChangeStatus.PENDING,
          },
          data: {
            status: CorporateTierChangeStatus.APPROVED,
            reviewedById: input.adminId,
            reviewedAt: new Date(),
            pendingKey: null,
          },
        });

        if (approved.count === 0) {
          throw new RequestClaimLostError();
        }
      }
    });
  } catch (error) {
    if (
      error instanceof TermsClaimLostError ||
      error instanceof RequestClaimLostError
    ) {
      return svcFail("CONFLICT", "Terms changed concurrently; reload and retry");
    }

    throw error;
  }

  return svcOk({ id: account.id });
}

// ---------------------------------------------------------------------------
// Suspend / reactivate (Stripe first — a Stripe failure never fakes a state)
// ---------------------------------------------------------------------------

/**
 * Suspends corporate access and pauses collection. The Stripe pause happens
 * first and outside any transaction: if it fails, the local status does not
 * claim a transition Stripe never performed.
 */
export async function suspendCorporateAccount(
  deps: CorporateAccountsDeps,
  input: { accountId: string; reason: string },
): Promise<ServiceResult<{ id: string }, never>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      membership: { select: { stripeSubscriptionId: true } },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.status !== CorporateStatus.ACTIVE) {
    return svcFail("CONFLICT", "Only active accounts can be suspended");
  }

  const stripeSubscriptionId = account.membership?.stripeSubscriptionId ?? null;

  if (stripeSubscriptionId !== null) {
    const paused = await pauseCorporateSubscription(deps, {
      accountId: account.id,
      stripeSubscriptionId,
    });

    if (!paused.ok) {
      return paused;
    }
  }

  const written = await deps.db.corporateAccount.updateMany({
    where: { id: account.id, status: CorporateStatus.ACTIVE },
    data: { status: CorporateStatus.SUSPENDED, statusReason: input.reason },
  });

  if (written.count === 0) {
    return svcFail("CONFLICT", "Corporate account changed concurrently");
  }

  return svcOk({ id: account.id });
}

/**
 * Resumes collection and reactivates access. `CANCELLED` is reserved to the
 * `customer.subscription.deleted` webhook (F7-07) and cannot be reactivated
 * here.
 */
export async function reactivateCorporateAccount(
  deps: CorporateAccountsDeps,
  input: { accountId: string },
): Promise<ServiceResult<{ id: string }, never>> {
  const account = await deps.db.corporateAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      membership: { select: { id: true, stripeSubscriptionId: true } },
    },
  });

  if (!account) {
    return svcFail("NOT_FOUND", "Corporate account not found");
  }

  if (account.status !== CorporateStatus.SUSPENDED) {
    return svcFail("CONFLICT", "Only suspended accounts can be reactivated");
  }

  const membership = account.membership;

  if (membership?.stripeSubscriptionId) {
    const resumed = await resumeCorporateSubscription(deps, {
      accountId: account.id,
      stripeSubscriptionId: membership.stripeSubscriptionId,
    });

    if (!resumed.ok) {
      return resumed;
    }

    // Sync the fresh remote state before reopening access.
    await deps.db.corporateMembership.updateMany({
      where: { id: membership.id },
      data: {
        status: resumed.data.status,
        renewsAt: resumed.data.renewsAt,
      },
    });
  }

  const written = await deps.db.corporateAccount.updateMany({
    where: { id: account.id, status: CorporateStatus.SUSPENDED },
    data: { status: CorporateStatus.ACTIVE, statusReason: null },
  });

  if (written.count === 0) {
    return svcFail("CONFLICT", "Corporate account changed concurrently");
  }

  return svcOk({ id: account.id });
}

// ---------------------------------------------------------------------------
// Tier change requests
// ---------------------------------------------------------------------------

/**
 * Rejects a pending tier-change request. It never modifies terms; the claim
 * filters by `id + corporateAccountId + status=PENDING` and releases
 * `pendingKey` atomically with the reviewer stamp.
 */
export async function rejectCorporateTierChange(
  deps: CorporateDirectoryDeps,
  input: { accountId: string; requestId: string; adminId: string },
): Promise<ServiceResult<{ id: string }, never>> {
  return deps.db.$transaction(async (tx) => {
    const request = await tx.corporateTierChangeRequest.findFirst({
      where: { id: input.requestId, corporateAccountId: input.accountId },
      select: { status: true },
    });

    if (!request) {
      return svcFail("NOT_FOUND", "Tier change request not found");
    }

    if (request.status !== CorporateTierChangeStatus.PENDING) {
      return svcFail("CONFLICT", "Tier change request is not pending");
    }

    const claimed = await tx.corporateTierChangeRequest.updateMany({
      where: {
        id: input.requestId,
        corporateAccountId: input.accountId,
        status: CorporateTierChangeStatus.PENDING,
      },
      data: {
        status: CorporateTierChangeStatus.REJECTED,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        pendingKey: null,
      },
    });

    if (claimed.count === 0) {
      return svcFail("CONFLICT", "Tier change request is not pending");
    }

    return svcOk({ id: input.requestId });
  });
}
