import "server-only";

import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";

import type { PrismaClient } from "@generated/prisma";
import { env } from "~/env";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/**
 * Latest Sonnet in the Vercel AI Gateway catalog. The plain string routes the
 * call through the Gateway (authenticated by `AI_GATEWAY_API_KEY`, which the
 * AI SDK reads from `process.env` on its own) — no provider package needed.
 */
export const DIAGNOSIS_MODEL = "anthropic/claude-sonnet-5";

/**
 * Marketplace categories a diagnosis may resolve to. They match the design's
 * C1 category chips and the seeded service catalog (`category` is a free
 * string column, so this list is the single source of truth for requests).
 */
export const REQUEST_CATEGORIES = [
  "Plomería",
  "Eléctrico",
  "Pintura",
  "Carpintería",
  "Limpieza",
  "Jardinería",
  "Clima",
  "Otro",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const URGENCY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

const diagnosisSchema = z.object({
  diagnosis: z
    .string()
    .min(1)
    .max(2_000)
    .describe(
      "Short diagnosis of the problem, written in Spanish (Mexico) for the customer.",
    ),
  confidencePct: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Honest confidence in the diagnosis, 0-100."),
  category: z
    .enum(REQUEST_CATEGORIES)
    .describe("Marketplace category that best matches the repair."),
  urgency: z
    .enum(URGENCY_LEVELS)
    .describe("How urgent the repair is for the household."),
  minPriceCents: z
    .number()
    .int()
    .nonnegative()
    .describe("Lower bound of the estimated price, in MXN cents."),
  maxPriceCents: z
    .number()
    .int()
    .nonnegative()
    .describe("Upper bound of the estimated price, in MXN cents."),
});

export type ProblemDiagnosis = z.infer<typeof diagnosisSchema>;

type DiagnoseErrorCode = "AI_UNAVAILABLE" | "INTERNAL_ERROR";

const DIAGNOSIS_TIMEOUT_MS = 45_000;

const PLATFORM_SETTINGS_ID = 1;

type DiagnosisSettings = {
  aiConfidenceThresholdPct: number;
  aiPriceMarginPct: number;
  aiPricingModel: string;
};

/**
 * System prompt built per call from `PlatformSettings` so pricing margins and
 * confidence thresholds stay admin-tunable. Never returned to the client.
 */
function buildInstructions(settings: DiagnosisSettings): string {
  return [
    "You are the diagnosis engine of HOME360, a home-maintenance marketplace",
    "operating in Chihuahua, Mexico. You receive photos of a household problem",
    "and an optional customer note, and you must produce a structured",
    "diagnosis for a service request.",
    "",
    "Rules:",
    "- All prices are in Mexican pesos (MXN) expressed as integer cents and",
    "  must reflect realistic local labor and material costs in Chihuahua.",
    `- Price range: keep the spread between minPriceCents and maxPriceCents`,
    `  around ${settings.aiPriceMarginPct}% of the midpoint (pricing model`,
    `  ${settings.aiPricingModel}); minPriceCents must never exceed`,
    "  maxPriceCents.",
    "- confidencePct is your honest confidence in the diagnosis. Platform",
    `  reviews diagnoses below ${settings.aiConfidenceThresholdPct}%, so never`,
    "  inflate it.",
    "- Write the diagnosis text in Spanish (Mexico), addressed to the",
    "  customer, concise and without technical jargon.",
    "- Choose the single marketplace category that best matches the repair;",
    '  use "Otro" only when nothing else fits.',
    "- urgency is LOW for cosmetic issues, MEDIUM for problems that worsen",
    "  over time, HIGH for active damage or safety risks (leaks, exposed",
    "  wiring, gas).",
    "- If the images do not show a home-maintenance problem, still answer the",
    "  schema with your best interpretation and a low confidencePct.",
  ].join("\n");
}

function buildUserMessage(input: {
  imageUrls: string[];
  description?: string;
}): ModelMessage {
  return {
    role: "user",
    content: [
      ...input.imageUrls.map((url) => ({
        type: "image" as const,
        image: new URL(url),
      })),
      {
        type: "text" as const,
        text:
          input.description && input.description.trim().length > 0
            ? `Customer note: ${input.description.trim()}`
            : "The customer did not add a note. Diagnose from the images.",
      },
    ],
  };
}

/**
 * Analyzes the request photos with Claude Sonnet through the Vercel AI
 * Gateway and returns a structured diagnosis. Backend only — the prompt and
 * any provider error are never exposed to the caller: every failure surfaces
 * as a clean `AI_UNAVAILABLE`.
 */
export async function diagnoseProblem(
  db: PrismaClient,
  input: { imageUrls: string[]; description?: string },
): Promise<ServiceResult<ProblemDiagnosis, DiagnoseErrorCode>> {
  if (!env.AI_GATEWAY_API_KEY) {
    return svcFail("AI_UNAVAILABLE", "AI gateway key is not configured");
  }

  if (input.imageUrls.length === 0) {
    return svcFail("INTERNAL_ERROR", "Diagnosis requires at least one image");
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: {
      aiConfidenceThresholdPct: true,
      aiPriceMarginPct: true,
      aiPricingModel: true,
    },
  });

  if (!settings) {
    return svcFail("INTERNAL_ERROR", "Platform settings are missing");
  }

  try {
    const { object } = await generateObject({
      model: DIAGNOSIS_MODEL,
      schema: diagnosisSchema,
      instructions: buildInstructions(settings),
      messages: [buildUserMessage(input)],
      abortSignal: AbortSignal.timeout(DIAGNOSIS_TIMEOUT_MS),
    });

    // The schema cannot express the cross-field bound, so normalize a swapped
    // range instead of failing the whole request.
    const minPriceCents = Math.min(object.minPriceCents, object.maxPriceCents);
    const maxPriceCents = Math.max(object.minPriceCents, object.maxPriceCents);

    return svcOk({ ...object, minPriceCents, maxPriceCents });
  } catch {
    // Timeouts, gateway/provider failures and malformed generations all end
    // here. The raw error is intentionally dropped so provider details never
    // leak through the contract.
    return svcFail("AI_UNAVAILABLE", "Diagnosis generation failed");
  }
}
