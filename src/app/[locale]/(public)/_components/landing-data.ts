import {
  BadgeCheckIcon,
  BuildingIcon,
  FileCheckIcon,
  LayersIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  UmbrellaIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Non-translatable landing data: anchor ids, mirrored plan figures and lucide
 * icons. Every visible string lives in `messages/{es,en}/landing.json`.
 */

/** Anchor ids consumed by the header nav and by each section wrapper. */
export const LANDING_ANCHORS = {
  howItWorks: "how-it-works",
  forBusiness: "for-business",
  guarantees: "guarantees",
  pricing: "pricing",
} as const;

export type LandingAnchorKey = keyof typeof LANDING_ANCHORS;

/** Nav order for the header and the footer sections column. */
export const LANDING_NAV_KEYS = [
  "howItWorks",
  "forBusiness",
  "guarantees",
  "pricing",
] as const satisfies readonly LandingAnchorKey[];

export type LandingPlanCode = "basic" | "standard" | "enterprise";

export type LandingPlan = {
  code: LandingPlanCode;
  /** Mirror of `prisma/seed/plans.ts`, the source of truth. */
  priceCents: number;
  /** Commission ladder from `spec/08-business-model-alignment.md` D1. */
  commissionPct: number;
  maxBranches: number | null;
  maxWorkers: number | null;
  maxProducts: number | null;
  highlighted: boolean;
};

export const LANDING_PLANS: readonly LandingPlan[] = [
  {
    code: "basic",
    priceCents: 49_900,
    commissionPct: 10,
    maxBranches: 1,
    maxWorkers: 3,
    maxProducts: 50,
    highlighted: false,
  },
  {
    code: "standard",
    priceCents: 99_900,
    commissionPct: 8,
    maxBranches: 5,
    maxWorkers: 15,
    maxProducts: null,
    highlighted: true,
  },
  {
    code: "enterprise",
    priceCents: 199_900,
    commissionPct: 5,
    maxBranches: null,
    maxWorkers: null,
    maxProducts: null,
    highlighted: false,
  },
];

/**
 * D8 — market figures, never our own traction. Source: 2025 partner deck and
 * CONAPO 2025, cited visibly by the metrics section.
 */
export const LANDING_METRICS = {
  households: 35_000_000,
  marketSizeCents: 35_000_000_000_000, // ~$350,000M MXN
  informalityPct: 95,
  readyProviders: 500,
} as const;

export type LandingFeatureKey =
  "aiDiagnosis" | "protectedPayments" | "realGuarantees";

export const LANDING_FEATURES: readonly {
  key: LandingFeatureKey;
  icon: LucideIcon;
}[] = [
  { key: "aiDiagnosis", icon: ScanSearchIcon },
  { key: "protectedPayments", icon: ShieldCheckIcon },
  { key: "realGuarantees", icon: BadgeCheckIcon },
];

export type LandingGuaranteeKey =
  "deposit" | "insurance" | "combined" | "verification" | "asset";

/** D7 — the five guarantee options, the differentiator of the deck. */
export const LANDING_GUARANTEES: readonly {
  key: LandingGuaranteeKey;
  recommended: boolean;
  icon: LucideIcon;
}[] = [
  { key: "deposit", recommended: false, icon: WalletIcon },
  { key: "insurance", recommended: false, icon: UmbrellaIcon },
  { key: "combined", recommended: true, icon: LayersIcon },
  { key: "verification", recommended: false, icon: FileCheckIcon },
  { key: "asset", recommended: false, icon: BuildingIcon },
];

export const LANDING_STEP_KEYS = ["1", "2", "3"] as const;
