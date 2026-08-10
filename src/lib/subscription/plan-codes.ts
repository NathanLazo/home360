import { z } from "zod";

/**
 * Canonical plan codes, shared by client and server.
 *
 * This module must stay free of Prisma, Stripe and `server-only` imports so the
 * subscription UI can import it. Every place that used to inline
 * `z.enum(["basic", "standard", "enterprise"])` — including `approveBusiness`
 * when F5-05 is implemented — imports `planCodeSchema` from here instead.
 */
export const PLAN_CODES = ["basic", "standard", "enterprise"] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export const planCodeSchema = z.enum(PLAN_CODES);
