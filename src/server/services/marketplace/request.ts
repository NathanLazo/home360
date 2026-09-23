import "server-only";

import {
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
  type ServiceRequest,
} from "@generated/prisma";
import {
  diagnoseProblem,
  type UrgencyLevel,
} from "~/server/services/ai/diagnose";
import {
  createDownloadUrl,
  isOwnedMediaPathname,
  type MediaKind,
} from "~/server/services/media/blob";
import {
  suggestForRequest,
  type RequestSuggestions,
} from "~/server/services/marketplace/suggestion";
import { notifyNearbyBusinesses } from "~/server/services/notifications/notify-request";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PAGE_SIZE = 20;

/** Statuses a customer may still cancel (P-WEB-02: QUOTED joins OPEN). */
const CANCELLABLE_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.OPEN,
  RequestStatus.QUOTED,
];

const TITLE_MAX_LENGTH = 80;

/** Media kinds a service request may reference (photos feed the AI). */
const REQUEST_MEDIA_KINDS: readonly MediaKind[] = [
  "requestPhoto",
  "requestVideo",
];

export type CreateRequestInput = {
  customerId: string;
  mediaPathnames: string[];
  description?: string;
  addressId: string;
};

export type CreateRequestResult = {
  request: ServiceRequest;
  /** Also persisted as `ServiceRequest.aiUrgency` (M3-W0); kept at the top
   * level so existing C3 consumers keep working. */
  urgency: UrgencyLevel;
  suggestions: RequestSuggestions;
};

export type RequestListResult = {
  items: ServiceRequest[];
  nextCursor: string | null;
};

type CreateRequestError =
  | "VALIDATION_ERROR"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

/**
 * Short customer-facing title derived from the note (preferred) or the AI
 * diagnosis, cut at a word boundary. `ServiceRequest.title` is required but
 * the mobile flow never asks for one.
 */
function deriveTitle(description: string | undefined, diagnosis: string) {
  const source = description?.trim() ? description.trim() : diagnosis.trim();

  if (source.length <= TITLE_MAX_LENGTH) {
    return source;
  }

  const cut = source.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > TITLE_MAX_LENGTH / 2 ? lastSpace : TITLE_MAX_LENGTH)}…`;
}

function isPathnameOfKind(pathname: string, kind: MediaKind): boolean {
  return pathname.split("/")[1] === kind;
}

/**
 * C2→C3 flow: validates the uploaded media belongs to the caller, runs the AI
 * diagnosis over short-lived signed photo URLs and persists the OPEN
 * `ServiceRequest` with the geo of the chosen address. `photoUrls` stores the
 * blob pathnames (signed URLs expire in minutes); the app exchanges them for
 * fresh URLs through `media.getDownloadUrl`.
 */
export async function createServiceRequest(
  db: PrismaClient,
  input: CreateRequestInput,
): Promise<ServiceResult<CreateRequestResult, CreateRequestError>> {
  const ownsEveryPathname = input.mediaPathnames.every((pathname) =>
    isOwnedMediaPathname(pathname, input.customerId, REQUEST_MEDIA_KINDS),
  );

  if (!ownsEveryPathname) {
    return svcFail("VALIDATION_ERROR", "Media pathname outside the caller namespace");
  }

  const photoPathnames = input.mediaPathnames.filter((pathname) =>
    isPathnameOfKind(pathname, "requestPhoto"),
  );

  if (photoPathnames.length === 0) {
    return svcFail("VALIDATION_ERROR", "At least one photo is required");
  }

  const address = await db.address.findFirst({
    where: { id: input.addressId, userId: input.customerId },
    select: {
      addressLine: true,
      neighborhood: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!address) {
    return svcFail("NOT_FOUND", "Address not found");
  }

  const imageUrls: string[] = [];

  for (const pathname of photoPathnames) {
    const grant = await createDownloadUrl(db, {
      userId: input.customerId,
      pathname,
    });

    if (!grant.ok) {
      return svcFail("INTERNAL_ERROR", "Could not resolve request media");
    }

    imageUrls.push(grant.data.url);
  }

  const diagnosis = await diagnoseProblem(db, {
    imageUrls,
    description: input.description,
  });

  if (!diagnosis.ok) {
    return diagnosis.code === "AI_UNAVAILABLE"
      ? svcFail("AI_UNAVAILABLE", "Diagnosis unavailable")
      : svcFail("INTERNAL_ERROR", "Diagnosis failed");
  }

  const request = await db.serviceRequest.create({
    data: {
      customerId: input.customerId,
      title: deriveTitle(input.description, diagnosis.data.diagnosis),
      description: input.description?.trim() ? input.description.trim() : null,
      category: diagnosis.data.category,
      photoUrls: input.mediaPathnames,
      aiConfidencePct: diagnosis.data.confidencePct,
      aiDiagnosis: diagnosis.data.diagnosis,
      aiMinPriceCents: diagnosis.data.minPriceCents,
      aiMaxPriceCents: diagnosis.data.maxPriceCents,
      aiUrgency: diagnosis.data.urgency,
      addressLine: address.addressLine,
      // Colonia snapshot (MA-13): the only textual address piece the radar
      // exposes to businesses before their quote is accepted.
      neighborhood: address.neighborhood,
      latitude: address.latitude,
      longitude: address.longitude,
      status: RequestStatus.OPEN,
    },
  });
  const suggestions = await suggestForRequest(db, {
    category: diagnosis.data.category,
    minPriceCents: diagnosis.data.minPriceCents,
    maxPriceCents: diagnosis.data.maxPriceCents,
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

  return svcOk({ request, urgency: diagnosis.data.urgency, suggestions });
}

/** Own requests only; a foreign id answers a generic NOT_FOUND. */
export async function getMyRequest(
  db: PrismaClient,
  input: { customerId: string; id: string },
): Promise<ServiceResult<ServiceRequest>> {
  const request = await db.serviceRequest.findFirst({
    where: { id: input.id, customerId: input.customerId },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  return svcOk(request);
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

/** Thrown inside the cancel transaction to roll it back with CONFLICT. */
class RequestNotCancellableError extends Error {}

/**
 * Only requests still collecting offers (OPEN or QUOTED, P-WEB-02) can be
 * cancelled; anything else is a CONFLICT. In one transaction the PENDING
 * quotes are expired first (quote-then-request lock order, same as
 * `acceptQuote`) and the request moves to CANCELLED conditionally, so a
 * concurrent accept either wins cleanly or rolls the cancel back.
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

  try {
    const cancelled = await db.$transaction(async (tx) => {
      await tx.quote.updateMany({
        where: { requestId: request.id, status: QuoteStatus.PENDING },
        data: { status: QuoteStatus.EXPIRED },
      });

      const updated = await tx.serviceRequest.updateMany({
        where: {
          id: request.id,
          customerId: input.customerId,
          status: { in: [...CANCELLABLE_REQUEST_STATUSES] },
        },
        data: { status: RequestStatus.CANCELLED },
      });

      if (updated.count === 0) {
        throw new RequestNotCancellableError();
      }

      return tx.serviceRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
    });

    return svcOk(cancelled);
  } catch (error) {
    if (error instanceof RequestNotCancellableError) {
      return svcFail("CONFLICT", "Only open requests can be cancelled");
    }

    throw error;
  }
}
