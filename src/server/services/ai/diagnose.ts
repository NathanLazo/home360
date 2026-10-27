import "server-only";

import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";

import type { PrismaClient } from "@generated/prisma";
import { env } from "~/env";
import type { AgentModelId } from "~/lib/agent/agent-models";
import { readMediaBytes } from "~/server/services/media/blob";
import { REQUEST_CATEGORIES } from "~/schemas/marketplace/request-categories";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/**
 * Vision diagnosis runs on Claude Sonnet 5.5 through the Vercel AI Gateway
 * (`AI_GATEWAY_API_KEY`); the gateway bills our own Anthropic key via BYOK,
 * configured in the Vercel dashboard.
 */
const DIAGNOSIS_MODEL = "anthropic/claude-sonnet-5-5";

/**
 * Gateway model reused by text-only flows (dispute summaries); shares the
 * assistant catalog in `agent-models.ts`.
 */
export const GATEWAY_TEXT_MODEL: AgentModelId = "spacexai/grok-4.7";

export {
  REQUEST_CATEGORIES,
  type RequestCategory,
} from "~/schemas/marketplace/request-categories";

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

/** Schema defaults of `PlatformSettings`, used when the row was never seeded. */
const DEFAULT_SETTINGS: DiagnosisSettings = {
  aiConfidenceThresholdPct: 85,
  aiPriceMarginPct: 25,
  aiPricingModel: "v3.2",
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

type ImageBytes = { data: Uint8Array; mediaType: string };

const IMAGE_FETCH_TIMEOUT_MS = 10_000;

const IMAGE_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Providers behind the AI Gateway may reject URL image sources, so the
 * private blobs are read server-side and handed to the model as inline bytes.
 */
async function readImage(pathname: string): Promise<ImageBytes> {
  const media = await readMediaBytes(pathname, {
    abortSignal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  });

  if (media === null) {
    throw new Error("Image not found in blob storage");
  }

  // Fall back to the pathname extension when the store answers a generic type.
  const mediaType = media.contentType.startsWith("image/")
    ? media.contentType
    : (IMAGE_TYPE_BY_EXTENSION[
        pathname.split(".").pop()?.toLowerCase() ?? ""
      ] ?? "image/jpeg");

  return { data: media.data, mediaType };
}

function buildUserMessage(input: {
  images: ImageBytes[];
  videoCount: number;
  description?: string;
}): ModelMessage {
  const videoCount = input.videoCount;
  // The model only receives images: a video is surfaced as context so the
  // diagnosis honestly lowers its confidence instead of pretending to see it.
  const videoContext =
    videoCount > 0
      ? `The customer also recorded ${videoCount} short video(s) that you cannot see; lower confidencePct accordingly.`
      : null;
  const note =
    input.description && input.description.trim().length > 0
      ? `Customer note: ${input.description.trim()}`
      : "The customer did not add a note. Diagnose from the images.";

  return {
    role: "user",
    content: [
      ...input.images.map((image) => ({
        type: "file" as const,
        data: image.data,
        mediaType: image.mediaType,
      })),
      {
        type: "text" as const,
        text: videoContext === null ? note : `${note}\n${videoContext}`,
      },
    ],
  };
}

/**
 * Analyzes the request photos with Claude Sonnet 5.5 through the Vercel AI
 * Gateway and returns a structured diagnosis. Backend only — the prompt and
 * any provider error are never exposed to the caller: every failure surfaces
 * as a clean `AI_UNAVAILABLE`.
 */
export async function diagnoseProblem(
  db: PrismaClient,
  input: { imagePathnames: string[]; videoCount: number; description?: string },
): Promise<ServiceResult<ProblemDiagnosis, DiagnoseErrorCode>> {
  if (!env.AI_GATEWAY_API_KEY) {
    return svcFail("AI_UNAVAILABLE", "AI gateway key is not configured");
  }

  if (input.imagePathnames.length === 0 && input.videoCount === 0) {
    return svcFail("INTERNAL_ERROR", "Diagnosis requires at least one media");
  }

  // Same rule as `settings/platform-policies.ts`: an unseeded singleton
  // falls back to the schema defaults instead of failing the diagnosis.
  const settings =
    (await db.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
      select: {
        aiConfidenceThresholdPct: true,
        aiPriceMarginPct: true,
        aiPricingModel: true,
      },
    })) ?? DEFAULT_SETTINGS;

  try {
    const images = await Promise.all(input.imagePathnames.map(readImage));
    const { object } = await generateObject({
      model: DIAGNOSIS_MODEL,
      schema: diagnosisSchema,
      instructions: buildInstructions(settings),
      messages: [buildUserMessage({ ...input, images })],
      abortSignal: AbortSignal.timeout(DIAGNOSIS_TIMEOUT_MS),
    });

    // The schema cannot express the cross-field bound, so normalize a swapped
    // range instead of failing the whole request.
    const minPriceCents = Math.min(object.minPriceCents, object.maxPriceCents);
    const maxPriceCents = Math.max(object.minPriceCents, object.maxPriceCents);

    return svcOk({ ...object, minPriceCents, maxPriceCents });
  } catch (error) {
    // Timeouts, gateway/provider failures and malformed generations all end
    // here. The error is logged for operators (name + message only, never
    // the prompt or media) and never leaks through the contract.
    console.error(
      "[ai/diagnose] generation failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );

    return svcFail("AI_UNAVAILABLE", "Diagnosis generation failed");
  }
}
