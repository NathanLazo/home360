import type {
  Plan,
  PlatformSettings,
  Prisma,
  PrismaClient,
} from "../../generated/prisma";

export type SeededPlans = {
  basic: Plan;
  standard: Plan;
  enterprise: Plan;
  settings: PlatformSettings;
};

const planData = [
  {
    id: "seed-plan-basic",
    code: "basic",
    name: "Básico",
    priceCents: 49_900,
    commissionPct: 10,
    maxBranches: 1,
    maxWorkers: 3,
    maxProducts: 50,
    stripePriceId: null,
  },
  {
    id: "seed-plan-standard",
    code: "standard",
    name: "Estándar",
    priceCents: 99_900,
    commissionPct: 8,
    maxBranches: 5,
    maxWorkers: 15,
    maxProducts: null,
    stripePriceId: null,
  },
  {
    id: "seed-plan-enterprise",
    code: "enterprise",
    name: "Empresarial",
    priceCents: 199_900,
    commissionPct: 5,
    maxBranches: null,
    maxWorkers: null,
    maxProducts: null,
    stripePriceId: null,
  },
] satisfies readonly Prisma.PlanUncheckedCreateInput[];

const platformSettings = {
  id: 1,
  aiConfidenceThresholdPct: 85,
  aiPriceMarginPct: 25,
  aiPricingModel: "v3.2",
  aiHumanReviewBelowThreshold: true,
  customerServiceFeeCents: 2_500,
  loyaltyBonusPct: 50,
  escrowAutoReleaseHours: 72,
  notifyNewRequestRadiusKm: 10,
  notifyPaymentRelease: true,
  notifyRatingReminderHours: 24,
} satisfies Prisma.PlatformSettingsUncheckedCreateInput;

export async function seedPlans(prisma: PrismaClient): Promise<SeededPlans> {
  const seededPlans = await Promise.all(
    planData.map(({ id, code, ...values }) =>
      prisma.plan.upsert({
        where: { code },
        create: { id, code, ...values },
        update: values,
      }),
    ),
  );

  const settings = await prisma.platformSettings.upsert({
    where: { id: platformSettings.id },
    create: platformSettings,
    update: platformSettings,
  });

  const [basic, standard, enterprise] = seededPlans;
  if (!basic || !standard || !enterprise) {
    throw new Error("Seed plans could not be created");
  }

  return { basic, standard, enterprise, settings };
}
