/**
 * Synchronises the corporate tier catalog with Stripe Billing (F7-03).
 *
 * Roger runs this once in test-mode:
 * `pnpm tsx scripts/sync-stripe-corporate-tiers.ts`.
 *
 * It creates one Product + monthly Price per catalog tier
 * (BASIC / STANDARD / ENTERPRISE) and persists the price id in
 * `CorporateTierConfig.stripePriceId`. CUSTOM is never synced: its price is
 * created per account by `ensureCorporateMonthlyPrice`.
 *
 * Idempotent, same pattern as `sync-stripe-plans.ts`: currency, interval and
 * `unit_amount` of an existing Price are verified. Unlike provider plans, a
 * changed fee here rotates to a NEW Price — Prices are immutable — without
 * deleting or deactivating the previous one, which may still back live
 * subscriptions.
 */
import Stripe from "stripe";

import { CorporateTier, PrismaClient } from "../generated/prisma";

/** Normative corporate ladder: spec/09-corporate-accounts.md §2. */
const EXPECTED_TIERS = [
  {
    tier: CorporateTier.BASIC,
    monthlyFeeCents: 150_000,
    maxLocations: 3,
    commissionPct: 10,
  },
  {
    tier: CorporateTier.STANDARD,
    monthlyFeeCents: 350_000,
    maxLocations: 15,
    commissionPct: 8,
  },
  {
    tier: CorporateTier.ENTERPRISE,
    monthlyFeeCents: 750_000,
    maxLocations: 50,
    commissionPct: 5,
  },
] as const;

const CURRENCY = "mxn";
const INTERVAL = "month";

type TierAction = "ok" | "created" | "rotated";

type TierReport = {
  tier: string;
  priceId: string;
  action: TierAction;
  detail: string;
};

function fail(message: string): never {
  console.error(`[sync-stripe-corporate-tiers] ${message}`);
  process.exit(1);
}

/**
 * Blocks on any divergence between the seeded catalog and the normative
 * ladder before a single write reaches Stripe.
 */
function assertNormativeCatalog(
  configs: {
    tier: CorporateTier;
    monthlyFeeCents: number | null;
    maxLocations: number | null;
    commissionPct: number | null;
  }[],
): void {
  const problems: string[] = [];

  for (const expected of EXPECTED_TIERS) {
    const actual = configs.find((config) => config.tier === expected.tier);

    if (!actual) {
      problems.push(`tier "${expected.tier}" is missing from the database`);
      continue;
    }

    if (actual.monthlyFeeCents !== expected.monthlyFeeCents) {
      problems.push(
        `tier "${expected.tier}" fee is ${actual.monthlyFeeCents ?? "null"}, expected ${expected.monthlyFeeCents}`,
      );
    }

    if (actual.maxLocations !== expected.maxLocations) {
      problems.push(
        `tier "${expected.tier}" maxLocations is ${actual.maxLocations ?? "null"}, expected ${expected.maxLocations}`,
      );
    }

    if (actual.commissionPct !== expected.commissionPct) {
      problems.push(
        `tier "${expected.tier}" commission is ${actual.commissionPct ?? "null"}%, expected ${expected.commissionPct}%`,
      );
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[sync-stripe-corporate-tiers] catalog: ${problem}`);
    }

    fail("catalog does not match the normative ladder; nothing was written");
  }
}

/**
 * Verifies an already persisted Price. A match reports "ok"; any divergence
 * (fee change, wrong currency/interval, inactive) rotates to a fresh Price
 * without touching the previous one.
 */
async function verifyExistingPrice(
  stripe: Stripe,
  priceId: string,
  monthlyFeeCents: number,
): Promise<{ matches: boolean; detail: string }> {
  const price = await stripe.prices.retrieve(priceId);
  const problems: string[] = [];

  if (!price.active) {
    problems.push("price is inactive");
  }

  if (price.currency !== CURRENCY) {
    problems.push(`currency is ${price.currency}, expected ${CURRENCY}`);
  }

  if (price.recurring?.interval !== INTERVAL) {
    problems.push(
      `interval is ${price.recurring?.interval ?? "one-time"}, expected ${INTERVAL}`,
    );
  }

  if (price.recurring !== null && price.recurring.interval_count !== 1) {
    problems.push(
      `interval_count is ${price.recurring.interval_count}, expected 1`,
    );
  }

  if (price.unit_amount !== monthlyFeeCents) {
    problems.push(
      `unit_amount is ${price.unit_amount ?? "null"}, expected ${monthlyFeeCents}`,
    );
  }

  return problems.length === 0
    ? { matches: true, detail: "matches the local tier" }
    : { matches: false, detail: problems.join("; ") };
}

/**
 * Finds the Product for a tier by its `corporateTier` metadata, or creates it.
 * Search is eventually consistent, so creation stays idempotent through a
 * deterministic idempotency key.
 */
async function ensureProduct(stripe: Stripe, tier: string): Promise<string> {
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['corporateTier']:'${tier}'`,
    limit: 1,
  });

  const existing = found.data[0];

  if (existing) {
    return existing.id;
  }

  const product = await stripe.products.create(
    {
      name: `HOME360 corporate ${tier}`,
      metadata: { corporateTier: tier },
    },
    { idempotencyKey: `corporate-tier-product-${tier}` },
  );

  return product.id;
}

async function createTierPrice(
  stripe: Stripe,
  tier: string,
  monthlyFeeCents: number,
): Promise<string> {
  const productId = await ensureProduct(stripe, tier);
  const price = await stripe.prices.create(
    {
      product: productId,
      currency: CURRENCY,
      unit_amount: monthlyFeeCents,
      recurring: { interval: INTERVAL },
      metadata: { corporateTier: tier },
    },
    { idempotencyKey: `corporate-tier-price-${tier}-${monthlyFeeCents}` },
  );

  return price.id;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // Instantiating Prisma first also loads `.env`, so the Stripe key is read
  // after the environment is populated.
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    await prisma.$disconnect();
    fail(
      "STRIPE_SECRET_KEY is not set; run with `tsx --env-file=.env scripts/sync-stripe-corporate-tiers.ts`",
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  const reports: TierReport[] = [];

  try {
    const configs = await prisma.corporateTierConfig.findMany({
      where: {
        tier: { in: EXPECTED_TIERS.map((expected) => expected.tier) },
      },
      select: {
        id: true,
        tier: true,
        monthlyFeeCents: true,
        maxLocations: true,
        commissionPct: true,
        stripePriceId: true,
      },
    });

    assertNormativeCatalog(configs);

    for (const config of configs) {
      const monthlyFeeCents = config.monthlyFeeCents;

      if (monthlyFeeCents === null) {
        // Unreachable after assertNormativeCatalog; kept for type narrowing.
        continue;
      }

      if (config.stripePriceId) {
        const verified = await verifyExistingPrice(
          stripe,
          config.stripePriceId,
          monthlyFeeCents,
        );

        if (verified.matches) {
          reports.push({
            tier: config.tier,
            priceId: config.stripePriceId,
            action: "ok",
            detail: verified.detail,
          });
          continue;
        }

        // Prices are immutable: rotate to a new one, keep the old alive for
        // any subscriptions still attached to it.
        const rotatedPriceId = await createTierPrice(
          stripe,
          config.tier,
          monthlyFeeCents,
        );

        await prisma.corporateTierConfig.update({
          where: { id: config.id },
          data: { stripePriceId: rotatedPriceId },
        });

        reports.push({
          tier: config.tier,
          priceId: rotatedPriceId,
          action: "rotated",
          detail: `previous ${config.stripePriceId}: ${verified.detail}`,
        });
        continue;
      }

      const priceId = await createTierPrice(
        stripe,
        config.tier,
        monthlyFeeCents,
      );

      await prisma.corporateTierConfig.update({
        where: { id: config.id },
        data: { stripePriceId: priceId },
      });

      reports.push({
        tier: config.tier,
        priceId,
        action: "created",
        detail: `${monthlyFeeCents} ${CURRENCY} / ${INTERVAL}`,
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  console.table(reports);
  console.log(
    "[sync-stripe-corporate-tiers] every catalog tier has a Stripe price (CUSTOM is per-account by design)",
  );
}

await main();
