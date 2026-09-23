import "server-only";

import type { AiUrgency, PrismaClient } from "@generated/prisma";
import { diagnoseProblem } from "~/server/services/ai/diagnose";
import {
  ownsRequestMedia,
  signRequestMedia,
} from "~/server/services/marketplace/request-media";
import {
  suggestForRequest,
  type RequestSuggestions,
} from "~/server/services/marketplace/suggestion";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** A stored diagnosis stays reusable by `request.create` for one day. */
const DIAGNOSIS_TTL_MS = 24 * 60 * 60 * 1_000;

export type StandaloneDiagnosis = {
  diagnosisId: string;
  diagnosis: string;
  confidencePct: number;
  category: string;
  urgency: AiUrgency;
  minPriceCents: number;
  maxPriceCents: number;
  suggestions: RequestSuggestions;
};

type DiagnoseError = "VALIDATION_ERROR" | "AI_UNAVAILABLE" | "INTERNAL_ERROR";

/**
 * C2→C3 without committing to a request (workstream D): runs the AI over the
 * caller's own media, freezes the result as a single-use `RequestDiagnosis`
 * and answers diagnosis + suggestions. `AI_UNAVAILABLE` tells the app to fall
 * back to the manual category picker.
 */
export async function diagnoseRequestMedia(
  db: PrismaClient,
  input: { userId: string; mediaPathnames: string[]; description?: string },
): Promise<ServiceResult<StandaloneDiagnosis, DiagnoseError>> {
  if (!ownsRequestMedia(input.userId, input.mediaPathnames)) {
    return svcFail(
      "VALIDATION_ERROR",
      "Media pathname outside the caller namespace",
    );
  }

  const media = await signRequestMedia(db, {
    userId: input.userId,
    mediaPathnames: input.mediaPathnames,
  });

  if (!media.ok) {
    return media;
  }

  const diagnosis = await diagnoseProblem(db, {
    imageUrls: media.data.imageUrls,
    videoUrls: media.data.videoUrls,
    description: input.description,
  });

  if (!diagnosis.ok) {
    return diagnosis.code === "AI_UNAVAILABLE"
      ? svcFail("AI_UNAVAILABLE", "Diagnosis unavailable")
      : svcFail("INTERNAL_ERROR", "Diagnosis failed");
  }

  const suggestions = await suggestForRequest(db, {
    category: diagnosis.data.category,
    minPriceCents: diagnosis.data.minPriceCents,
    maxPriceCents: diagnosis.data.maxPriceCents,
  });
  const description = input.description?.trim();
  const stored = await db.requestDiagnosis.create({
    data: {
      userId: input.userId,
      mediaPathnames: input.mediaPathnames,
      description: description?.length ? description : null,
      diagnosis: diagnosis.data.diagnosis,
      confidencePct: diagnosis.data.confidencePct,
      category: diagnosis.data.category,
      urgency: diagnosis.data.urgency,
      minPriceCents: diagnosis.data.minPriceCents,
      maxPriceCents: diagnosis.data.maxPriceCents,
      suggestedServiceId: suggestions.service?.id ?? null,
      suggestedProductId: suggestions.product?.id ?? null,
      expiresAt: new Date(Date.now() + DIAGNOSIS_TTL_MS),
    },
    select: { id: true },
  });

  return svcOk({
    diagnosisId: stored.id,
    diagnosis: diagnosis.data.diagnosis,
    confidencePct: diagnosis.data.confidencePct,
    category: diagnosis.data.category,
    urgency: diagnosis.data.urgency,
    minPriceCents: diagnosis.data.minPriceCents,
    maxPriceCents: diagnosis.data.maxPriceCents,
    suggestions,
  });
}
