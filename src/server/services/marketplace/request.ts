import "server-only";

import {
  QuoteStatus,
  RequestStatus,
  type AiUrgency,
  type PrismaClient,
  type ServiceRequest,
} from "@generated/prisma";
import { diagnoseProblem } from "~/server/services/ai/diagnose";
import {
  ownsRequestMedia,
  signRequestMedia,
} from "~/server/services/marketplace/request-media";
import {
  resolveRequestLocation,
  type RequestLocationInput,
} from "~/server/services/marketplace/request-location";
import {
  loadSuggestionsByIds,
  suggestForRequest,
  type RequestSuggestions,
} from "~/server/services/marketplace/suggestion";
import { notifyNearbyBusinesses } from "~/server/services/notifications/notify-request";
import { requiresHumanReview } from "~/server/services/settings/platform-policies";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PAGE_SIZE = 20;

const TITLE_MAX_LENGTH = 80;

/**
 * Where the diagnosis comes from (workstream D):
 * - `AI`: run the model now over the request media (legacy one-shot flow).
 * - `STORED`: reuse a prior `request.diagnose` result by id (single use).
 * - `MANUAL`: the AI was unavailable and the customer picked the category.
 */
export type RequestDiagnosisSource =
  | { kind: "AI" }
  | { kind: "STORED"; diagnosisId: string }
  | { kind: "MANUAL"; category: string };

export type CreateRequestInput = {
  customerId: string;
  mediaPathnames: string[];
  description?: string;
  location: RequestLocationInput;
  diagnosis: RequestDiagnosisSource;
};

export type CreateRequestResult = {
  request: ServiceRequest;
  /** Also persisted as `ServiceRequest.aiUrgency` (M3-W0); kept at the top
   * level so existing C3 consumers keep working. Null for manual requests. */
  urgency: AiUrgency | null;
  suggestions: RequestSuggestions;
};

export type RequestDetail = ServiceRequest & {
  suggestions: RequestSuggestions;
};

export type RequestListResult = {
  items: ServiceRequest[];
  nextCursor: string | null;
};

type CreateRequestError =
  | "VALIDATION_ERROR"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "LOCATION_COORDINATES_REQUIRED";

type ResolvedDiagnosis = {
  mediaPathnames: string[];
  category: string;
  diagnosis: string | null;
  confidencePct: number | null;
  urgency: AiUrgency | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  storedDiagnosisId: string | null;
  suggestedServiceId: string | null;
  suggestedProductId: string | null;
};

/**
 * Short customer-facing title derived from the note (preferred) or the AI
 * diagnosis, cut at a word boundary. `ServiceRequest.title` is required but
 * the mobile flow never asks for one.
 */
function deriveTitle(description: string | undefined, fallback: string) {
  const source = description?.trim() ? description.trim() : fallback.trim();

  if (source.length <= TITLE_MAX_LENGTH) {
    return source;
  }

  const cut = source.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > TITLE_MAX_LENGTH / 2 ? lastSpace : TITLE_MAX_LENGTH)}…`;
}

async function resolveDiagnosis(
  db: PrismaClient,
  input: CreateRequestInput,
): Promise<ServiceResult<ResolvedDiagnosis, CreateRequestError>> {
  if (input.diagnosis.kind === "MANUAL") {
    return svcOk({
      mediaPathnames: input.mediaPathnames,
      category: input.diagnosis.category,
      diagnosis: null,
      confidencePct: null,
      urgency: null,
      minPriceCents: null,
      maxPriceCents: null,
      storedDiagnosisId: null,
      suggestedServiceId: null,
      suggestedProductId: null,
    });
  }

  if (input.diagnosis.kind === "STORED") {
    const stored = await db.requestDiagnosis.findFirst({
      where: {
        id: input.diagnosis.diagnosisId,
        userId: input.customerId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      return svcFail("NOT_FOUND", "Diagnosis not found");
    }

    return svcOk({
      mediaPathnames:
        input.mediaPathnames.length > 0
          ? input.mediaPathnames
          : stored.mediaPathnames,
      category: stored.category,
      diagnosis: stored.diagnosis,
      confidencePct: stored.confidencePct,
      urgency: stored.urgency,
      minPriceCents: stored.minPriceCents,
      maxPriceCents: stored.maxPriceCents,
      storedDiagnosisId: stored.id,
      suggestedServiceId: stored.suggestedServiceId,
      suggestedProductId: stored.suggestedProductId,
    });
  }

  const media = await signRequestMedia(db, {
    userId: input.customerId,
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

  return svcOk({
    mediaPathnames: input.mediaPathnames,
    category: diagnosis.data.category,
    diagnosis: diagnosis.data.diagnosis,
    confidencePct: diagnosis.data.confidencePct,
    urgency: diagnosis.data.urgency,
    minPriceCents: diagnosis.data.minPriceCents,
    maxPriceCents: diagnosis.data.maxPriceCents,
    storedDiagnosisId: null,
    suggestedServiceId: suggestions.service?.id ?? null,
    suggestedProductId: suggestions.product?.id ?? null,
  });
}

/**
 * C2→C3 flow: validates the uploaded media belongs to the caller, resolves
 * the diagnosis (fresh AI run, stored `request.diagnose` result or manual
 * category) and persists the OPEN `ServiceRequest` with the geo of the chosen
 * address — or the chosen corporate location for corporate consumers (F7).
 * `photoUrls` stores the blob pathnames (signed URLs expire in minutes); the
 * app exchanges them for fresh URLs through `media.getDownloadUrl`.
 */
export async function createServiceRequest(
  db: PrismaClient,
  input: CreateRequestInput,
): Promise<ServiceResult<CreateRequestResult, CreateRequestError>> {
  if (!ownsRequestMedia(input.customerId, input.mediaPathnames)) {
    return svcFail(
      "VALIDATION_ERROR",
      "Media pathname outside the caller namespace",
    );
  }

  const location = await resolveRequestLocation(db, input.location);

  if (!location.ok) {
    return location;
  }

  const resolved = await resolveDiagnosis(db, input);

  if (!resolved.ok) {
    return resolved;
  }

  const diagnosis = resolved.data;
  const description = input.description?.trim();
  // W13 "Revisión humana bajo el umbral" (settings/platform-policies).
  const needsHumanReview =
    diagnosis.confidencePct !== null &&
    (await requiresHumanReview(db, diagnosis.confidencePct));
  const request = await db.$transaction(async (tx) => {
    if (diagnosis.storedDiagnosisId !== null) {
      const consumed = await tx.requestDiagnosis.updateMany({
        where: { id: diagnosis.storedDiagnosisId, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (consumed.count === 0) {
        return null;
      }
    }

    return tx.serviceRequest.create({
      data: {
        customerId: input.customerId,
        title: deriveTitle(
          description,
          diagnosis.diagnosis ?? diagnosis.category,
        ),
        description: description?.length ? description : null,
        category: diagnosis.category,
        photoUrls: diagnosis.mediaPathnames,
        aiConfidencePct: diagnosis.confidencePct,
        needsHumanReview,
        aiDiagnosis: diagnosis.diagnosis,
        aiMinPriceCents: diagnosis.minPriceCents,
        aiMaxPriceCents: diagnosis.maxPriceCents,
        aiUrgency: diagnosis.urgency,
        addressLine: location.data.addressLine,
        // Colonia snapshot (MA-13): the only textual address piece the radar
        // exposes to businesses before their quote is accepted.
        neighborhood: location.data.neighborhood,
        latitude: location.data.latitude,
        longitude: location.data.longitude,
        corporateAccountId: location.data.corporateAccountId,
        corporateLocationId: location.data.corporateLocationId,
        suggestedServiceId: diagnosis.suggestedServiceId,
        suggestedProductId: diagnosis.suggestedProductId,
        status: RequestStatus.OPEN,
      },
    });
  });

  if (!request) {
    return svcFail("CONFLICT", "Diagnosis was already used");
  }

  const suggestions = await loadSuggestionsByIds(db, {
    serviceId: diagnosis.suggestedServiceId,
    productId: diagnosis.suggestedProductId,
  });

  // Fire-and-forget (M2-W3): notifying nearby businesses must never delay or
  // fail the customer's response. The service catches its own errors; this
  // guard only logs whatever still escapes.
  void notifyNearbyBusinesses(db, request.id)
    .then((notified) => {
      if (!notified.ok) {
        console.error(
          `[notify-request] ${notified.code} for request ${request.id}`,
        );
      }
    })
    .catch((error: unknown) => {
      console.error(`[notify-request] failed for request ${request.id}`, error);
    });

  return svcOk({ request, urgency: diagnosis.urgency, suggestions });
}

/**
 * Own requests only; a foreign id answers a generic NOT_FOUND. The frozen
 * suggestions are re-hydrated so C3 can be reopened later.
 */
export async function getMyRequest(
  db: PrismaClient,
  input: { customerId: string; id: string },
): Promise<ServiceResult<RequestDetail>> {
  const request = await db.serviceRequest.findFirst({
    where: { id: input.id, customerId: input.customerId },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const suggestions = await loadSuggestionsByIds(db, {
    serviceId: request.suggestedServiceId,
    productId: request.suggestedProductId,
  });

  return svcOk({ ...request, suggestions });
}

/** Cursor pagination over the caller's requests (F2-05 pattern). */
export async function listMyRequests(
  db: PrismaClient,
  input: { customerId: string; cursor?: string },
): Promise<ServiceResult<RequestListResult>> {
  if (input.cursor) {
    const cursorRow = await db.serviceRequest.findFirst({
      where: { id: input.cursor, customerId: input.customerId },
      select: { id: true },
    });

    if (!cursorRow) {
      return svcFail("NOT_FOUND", "Request cursor not found");
    }
  }

  const rows = await db.serviceRequest.findMany({
    where: { customerId: input.customerId },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const items = rows.slice(0, PAGE_SIZE);
  const nextCursor =
    rows.length > PAGE_SIZE ? (items.at(-1)?.id ?? null) : null;

  return svcOk({ items, nextCursor });
}

const CANCELLABLE_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.OPEN,
  RequestStatus.QUOTED,
];

/**
 * OPEN or QUOTED requests (no accepted offer yet) can be cancelled; anything
 * else is a CONFLICT. Pending offers on the request expire with it. The claim
 * is conditional so a concurrent `quote.accept` cannot be overwritten.
 */
export async function cancelMyRequest(
  db: PrismaClient,
  input: { customerId: string; id: string },
): Promise<ServiceResult<ServiceRequest>> {
  const request = await db.serviceRequest.findFirst({
    where: { id: input.id, customerId: input.customerId },
    select: { id: true, status: true },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  if (!CANCELLABLE_REQUEST_STATUSES.includes(request.status)) {
    return svcFail("CONFLICT", "Only open requests can be cancelled");
  }

  const cancelled = await db.$transaction(async (tx) => {
    const claimed = await tx.serviceRequest.updateMany({
      where: {
        id: request.id,
        status: { in: CANCELLABLE_REQUEST_STATUSES },
      },
      data: { status: RequestStatus.CANCELLED },
    });

    if (claimed.count === 0) {
      return null;
    }

    await tx.quote.updateMany({
      where: { requestId: request.id, status: QuoteStatus.PENDING },
      data: { status: QuoteStatus.EXPIRED },
    });

    return tx.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  });

  if (!cancelled) {
    return svcFail("CONFLICT", "Only open requests can be cancelled");
  }

  return svcOk(cancelled);
}
