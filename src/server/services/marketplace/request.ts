import "server-only";

import {
  BusinessStatus,
  QuoteStatus,
  RequestStatus,
  ServiceStatus,
  type AiUrgency,
  type PrismaClient,
  type ServiceRequest,
} from "@generated/prisma";
import { diagnoseProblem } from "~/server/services/ai/diagnose";
import { createDownloadUrl } from "~/server/services/media/blob";
import {
  ownsRequestMedia,
  resolveRequestMedia,
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
  /** D10-11: aim the request at one ACTIVE business (and service). */
  target?: { businessId?: string; serviceId?: string };
};

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const DEFAULT_REQUEST_TTL_HOURS = 72;

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

/** D10-13: a request row plus what the "Mis solicitudes" list needs. */
export type RequestListItem = ServiceRequest & {
  pendingQuoteCount: number;
  /** Order created by the accepted quote, if any (open it from the list). */
  acceptedOrderId: string | null;
  targetBusiness: { id: string; name: string } | null;
  /** Signed, short-lived URL of the first request photo (null without one). */
  thumbnailUrl: string | null;
};

export type RequestListResult = {
  items: RequestListItem[];
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

  const media = await resolveRequestMedia(db, {
    userId: input.customerId,
    mediaPathnames: input.mediaPathnames,
  });

  if (!media.ok) {
    return media;
  }

  const diagnosis = await diagnoseProblem(db, {
    imagePathnames: media.data.imagePathnames,
    videoCount: media.data.videoCount,
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

type ResolvedTarget = {
  targetBusinessId: string | null;
  targetServiceId: string | null;
};

/**
 * D10-11 target: a service implies its business; a business alone is valid
 * when ACTIVE. Inactive, unknown or mismatched targets are a NOT_FOUND.
 */
async function resolveRequestTarget(
  db: PrismaClient,
  target: CreateRequestInput["target"],
): Promise<ServiceResult<ResolvedTarget>> {
  if (!target || (!target.businessId && !target.serviceId)) {
    return svcOk({ targetBusinessId: null, targetServiceId: null });
  }

  if (target.serviceId) {
    const service = await db.service.findFirst({
      where: {
        id: target.serviceId,
        status: ServiceStatus.ACTIVE,
        business: { status: BusinessStatus.ACTIVE },
        ...(target.businessId ? { businessId: target.businessId } : {}),
      },
      select: { id: true, businessId: true },
    });

    return service
      ? svcOk({
          targetBusinessId: service.businessId,
          targetServiceId: service.id,
        })
      : svcFail("NOT_FOUND", "Target service not found");
  }

  const business = await db.business.findFirst({
    where: { id: target.businessId, status: BusinessStatus.ACTIVE },
    select: { id: true },
  });

  return business
    ? svcOk({ targetBusinessId: business.id, targetServiceId: null })
    : svcFail("NOT_FOUND", "Target business not found");
}

async function requestExpiresAt(db: PrismaClient, now: Date): Promise<Date> {
  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { requestTtlHours: true },
  });
  const hours =
    settings &&
    Number.isInteger(settings.requestTtlHours) &&
    settings.requestTtlHours > 0
      ? settings.requestTtlHours
      : DEFAULT_REQUEST_TTL_HOURS;

  return new Date(now.getTime() + hours * MILLISECONDS_PER_HOUR);
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

  const target = await resolveRequestTarget(db, input.target);

  if (!target.ok) {
    return target;
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
  // D10-5: requests stop accepting offers after `requestTtlHours`.
  const expiresAt = await requestExpiresAt(db, new Date());
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
        targetBusinessId: target.data.targetBusinessId,
        targetServiceId: target.data.targetServiceId,
        expiresAt,
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

function isRequestPhotoPathname(pathname: string): boolean {
  return pathname.split("/")[1] === "requestPhoto";
}

/**
 * Cursor pagination over the caller's requests (F2-05 pattern), enriched
 * for the customer list (D10-13): pending quote count, accepted order id,
 * the targeted business and a signed thumbnail of the first photo.
 */
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
    include: {
      targetBusiness: { select: { id: true, name: true } },
      quotes: {
        where: { status: QuoteStatus.ACCEPTED },
        select: { order: { select: { id: true } } },
        take: 1,
      },
      _count: {
        select: { quotes: { where: { status: QuoteStatus.PENDING } } },
      },
    },
  });
  const page = rows.slice(0, PAGE_SIZE);
  const nextCursor = rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null;
  const items = await Promise.all(
    page.map(async ({ quotes, _count, ...request }) => {
      const photo = request.photoUrls.find(isRequestPhotoPathname) ?? null;
      const grant = photo
        ? await createDownloadUrl(db, {
            userId: input.customerId,
            pathname: photo,
          })
        : null;

      return {
        ...request,
        pendingQuoteCount: _count.quotes,
        acceptedOrderId: quotes[0]?.order?.id ?? null,
        thumbnailUrl: grant?.ok ? grant.data.url : null,
      };
    }),
  );

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
