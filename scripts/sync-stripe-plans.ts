/**
 * Synchronises the three seeded `Plan` rows with Stripe Billing.
 *
 * Roger runs this once in test-mode: `pnpm tsx scripts/sync-stripe-plans.ts`.
 * It is the ONLY place where subscription Products and Prices are created;
 * `changePlan` (F4-04) fails with `PLAN_NOT_SYNCED` when a plan has no
 * `stripePriceId`.
 *
 * The script is idempotent and deliberately conservative: a plan whose remote
 * Price no longer matches the local amount, currency or interval is reported as
 * blocked instead of rotated, because the grandfathering policy for live
 * subscribers is still an open business decision (F3-F4-findings #24).
 */
import Stripe from "stripe";

import { PrismaClient } from "../generated/prisma";

/**
 * Normative commercial ladder: spec/08-business-model-alignment.md D1 (10/8/5)
 * and spec/04-subscriptions.md §1 for the per-plan limits.
 */
const EXPECTED_PLANS = [
  {
    code: "basic",
    priceCents: 49_900,
    commissionPct: 10,
    maxBranches: 1,
    maxWorkers: 3,
    maxProducts: 50,
  },
  {
    code: "standard",
    priceCents: 99_900,
    commissionPct: 8,
    maxBranches: 5,
    maxWorkers: 15,
    maxProducts: null,
  },
  {
    code: "enterprise",
    priceCents: 199_900,
    commissionPct: 5,
    maxBranches: null,
    maxWorkers: null,
    maxProducts: null,
  },
] as const;

const CURRENCY = "mxn";
const INTERVAL = "month";

type PlanAction = "ok" | "created" | "blocked-price-change";

type PlanReport = {
  code: string;
  priceId: string;
  action: PlanAction;
  detail: string;
};

function fail(message: string): never {
  console.error(`[sync-stripe-plans] ${message}`);
  process.exit(1);
}

function describeLimit(limit: number | null): string {
  return limit === null ? "unlimited" : String(limit);
}

/**
 * Blocks on any divergence between the database and the normative ladder before
 * a single write reaches Stripe, so a misconfigured seed can never publish a
 * wrong price.
 */
function assertNormativeCatalog(
  plans: {
    code: string;
    priceCents: number;
    commissionPct: number;
    maxBranches: number | null;
    maxWorkers: number | null;
    maxProducts: number | null;
  }[],
): void {
  const problems: string[] = [];

  if (plans.length !== EXPECTED_PLANS.length) {
    problems.push(
      `expected exactly ${EXPECTED_PLANS.length} plans, found ${plans.length}`,
    );
  }

  for (const expected of EXPECTED_PLANS) {
    const actual = plans.find((plan) => plan.code === expected.code);

    if (!actual) {
      problems.push(`plan "${expected.code}" is missing from the database`);
      continue;
    }

    if (actual.priceCents !== expected.priceCents) {
      problems.push(
        `plan "${expected.code}" price is ${actual.priceCents}, expected ${expected.priceCents}`,
      );
    }

    if (actual.commissionPct !== expected.commissionPct) {
      problems.push(
        `plan "${expected.code}" commission is ${actual.commissionPct}%, expected ${expected.commissionPct}%`,
      );
    }

    if (actual.maxBranches !== expected.maxBranches) {
      problems.push(
        `plan "${expected.code}" maxBranches is ${describeLimit(actual.maxBranches)}, expected ${describeLimit(expected.maxBranches)}`,
      );
    }

    if (actual.maxWorkers !== expected.maxWorkers) {
      problems.push(
        `plan "${expected.code}" maxWorkers is ${describeLimit(actual.maxWorkers)}, expected ${describeLimit(expected.maxWorkers)}`,
      );
    }

    if (actual.maxProducts !== expected.maxProducts) {
      problems.push(
        `plan "${expected.code}" maxProducts is ${describeLimit(actual.maxProducts)}, expected ${describeLimit(expected.maxProducts)}`,
      );
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[sync-stripe-plans] catalog: ${problem}`);
    }

    fail("catalog does not match the normative ladder; nothing was written");
  }
}

/**
 * Verifies an already persisted Price still matches the local plan. Any
 * divergence is reported, never repaired: rotating a Price here would silently
 * pick a grandfathering policy nobody has decided.
 */
async function verifyExistingPrice(
  stripe: Stripe,
  code: string,
  priceId: string,
  priceCents: number,
): Promise<PlanReport> {
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

  if (price.unit_amount !== priceCents) {
    problems.push(
      `unit_amount is ${price.unit_amount ?? "null"}, expected ${priceCents}`,
    );
  }

  if (problems.length > 0) {
    return {
      code,
      priceId,
      action: "blocked-price-change",
      detail: problems.join("; "),
    };
  }

  return { code, priceId, action: "ok", detail: "matches the local plan" };
}

/**
 * Finds the Product for a plan by its `planCode` metadata, or creates it. Search
 * is eventually consistent on Stripe's side, so creation stays idempotent
 * through a deterministic idempotency key.
 */
async function ensureProduct(
  stripe: Stripe,
  code: string,
  name: string,
): Promise<string> {
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['planCode']:'${code}'`,
    limit: 1,
  });

  const existing = found.data[0];

  if (existing) {
    return existing.id;
  }

  const product = await stripe.products.create(
    {
      name,
      metadata: { planCode: code },
    },
    { idempotencyKey: `plan-product-${code}` },
  );

  return product.id;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // Instantiating Prisma first also loads `.env`, so the Stripe key is read
  // after the environment is populated.
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    await prisma.$disconnect();
    fail(
      "STRIPE_SECRET_KEY is not set; run with `tsx --env-file=.env scripts/sync-stripe-plans.ts`",
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  const reports: PlanReport[] = [];

  try {
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        priceCents: true,
        commissionPct: true,
        maxBranches: true,
        maxWorkers: true,
        maxProducts: true,
        stripePriceId: true,
      },
      orderBy: { priceCents: "asc" },
    });

    assertNormativeCatalog(plans);

    for (const plan of plans) {
      if (plan.stripePriceId) {
        reports.push(
          await verifyExistingPrice(
            stripe,
            plan.code,
            plan.stripePriceId,
            plan.priceCents,
          ),
        );
        continue;
      }

      const productId = await ensureProduct(stripe, plan.code, plan.name);

      const price = await stripe.prices.create(
        {
          product: productId,
          currency: CURRENCY,
          unit_amount: plan.priceCents,
          recurring: { interval: INTERVAL },
          metadata: { planCode: plan.code },
        },
        { idempotencyKey: `plan-price-${plan.code}-${plan.priceCents}` },
      );

      await prisma.plan.update({
        where: { id: plan.id },
        data: { stripePriceId: price.id },
      });

      reports.push({
        code: plan.code,
        priceId: price.id,
        action: "created",
        detail: `product ${productId}`,
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  console.table(reports);

  const blocked = reports.filter(
    (report) => report.action === "blocked-price-change",
  );

  if (blocked.length > 0) {
    fail(
      `${blocked.length} plan(s) need a price-change policy decision before syncing`,
    );
  }

  console.log("[sync-stripe-plans] every plan has a Stripe price");
}

await main();
