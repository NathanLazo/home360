import {
  CorporateStatus,
  CorporateTier,
  UserRole,
} from "../../generated/prisma";
import type {
  CorporateAccount,
  CorporateLocation,
  CorporateTierConfig,
  Prisma,
  PrismaClient,
  User,
} from "../../generated/prisma";
import { hashPassword } from "../../src/server/services/auth/password";

export type SeededCorporate = {
  tierConfigs: {
    basic: CorporateTierConfig;
    standard: CorporateTierConfig;
    enterprise: CorporateTierConfig;
    custom: CorporateTierConfig;
  };
  demoOwner: User;
  demoAccount: CorporateAccount;
  demoLocations: readonly CorporateLocation[];
};

// Reference catalog for onboarding (spec/09 §2). CUSTOM keeps fee, limit,
// commission and Stripe price null: terms are negotiated per account and no
// placeholder must look like approved terms.
const tierConfigData = [
  {
    id: "seed-corporate-tier-basic",
    tier: CorporateTier.BASIC,
    monthlyFeeCents: 150_000,
    maxLocations: 3,
    commissionPct: 10,
    stripePriceId: null,
    isActive: true,
  },
  {
    id: "seed-corporate-tier-standard",
    tier: CorporateTier.STANDARD,
    monthlyFeeCents: 350_000,
    maxLocations: 15,
    commissionPct: 8,
    stripePriceId: null,
    isActive: true,
  },
  {
    id: "seed-corporate-tier-enterprise",
    tier: CorporateTier.ENTERPRISE,
    monthlyFeeCents: 750_000,
    maxLocations: 50,
    commissionPct: 5,
    stripePriceId: null,
    isActive: true,
  },
  {
    id: "seed-corporate-tier-custom",
    tier: CorporateTier.CUSTOM,
    monthlyFeeCents: null,
    maxLocations: null,
    commissionPct: null,
    stripePriceId: null,
    isActive: true,
  },
] satisfies readonly Prisma.CorporateTierConfigUncheckedCreateInput[];

const demoOwnerEmail = "corporativo@hotelesmirador.mx";

const demoLocationData = [
  {
    id: "seed-corporate-location-01",
    name: "Hotel Mirador Centro",
    addressLine: "Av. Independencia 500, Col. Centro",
    city: "Chihuahua",
    contactName: "Patricia Salas",
    contactPhone: "+52 614 555 0101",
  },
  {
    id: "seed-corporate-location-02",
    name: "Hotel Mirador Norte",
    addressLine: "Periférico de la Juventud 3100",
    city: "Chihuahua",
    contactName: "Jorge Baeza",
    contactPhone: "+52 614 555 0102",
  },
  {
    id: "seed-corporate-location-03",
    name: "Hotel Mirador Universidad",
    addressLine: "Av. Universidad 2020, Col. San Felipe",
    city: "Chihuahua",
    contactName: "Elena Chávez",
    contactPhone: "+52 614 555 0103",
  },
  {
    id: "seed-corporate-location-04",
    name: "Hotel Mirador Aeropuerto",
    addressLine: "Blvd. Juan Pablo II 4500",
    city: "Chihuahua",
    contactName: "Raúl Domínguez",
    contactPhone: "+52 614 555 0104",
  },
] as const;

export async function seedCorporate(
  prisma: PrismaClient,
): Promise<SeededCorporate> {
  const configs = await Promise.all(
    tierConfigData.map(({ id, tier, ...values }) =>
      prisma.corporateTierConfig.upsert({
        where: { tier },
        create: { id, tier, ...values },
        update: values,
      }),
    ),
  );

  const [basic, standard, enterprise, custom] = configs;
  if (!basic || !standard || !enterprise || !custom) {
    throw new Error("Seed corporate tier configs could not be created");
  }

  if (
    standard.monthlyFeeCents === null ||
    standard.maxLocations === null ||
    standard.commissionPct === null
  ) {
    throw new Error("Seed STANDARD tier config is missing its terms");
  }

  const passwordHash = await hashPassword("Home360!demo");
  const demoOwner = await prisma.user.upsert({
    where: { email: demoOwnerEmail },
    create: {
      id: "seed-user-corporate-mirador",
      email: demoOwnerEmail,
      name: "Hoteles Mirador",
      role: UserRole.CORPORATE,
      passwordHash,
    },
    update: { role: UserRole.CORPORATE, passwordHash },
  });

  // Demo account copies the STANDARD catalog terms. It stays PENDING and
  // without Stripe identifiers: activation (F7) creates the real customer
  // and subscription.
  const accountValues = {
    name: "Hoteles Mirador",
    taxId: "HMI150322AB1",
    tier: CorporateTier.STANDARD,
    status: CorporateStatus.PENDING,
    commissionPct: standard.commissionPct,
    monthlyFeeCents: standard.monthlyFeeCents,
    maxLocations: standard.maxLocations,
  };
  const demoAccount = await prisma.corporateAccount.upsert({
    where: { ownerId: demoOwner.id },
    create: {
      id: "seed-corporate-account-mirador",
      ownerId: demoOwner.id,
      ...accountValues,
    },
    update: accountValues,
  });

  const demoLocations = await Promise.all(
    demoLocationData.map(({ id, ...values }) =>
      prisma.corporateLocation.upsert({
        where: { id },
        create: { id, corporateAccountId: demoAccount.id, ...values },
        update: { corporateAccountId: demoAccount.id, ...values },
      }),
    ),
  );

  return {
    tierConfigs: { basic, standard, enterprise, custom },
    demoOwner,
    demoAccount,
    demoLocations,
  };
}
