import "server-only";

import {
  QuoteStatus,
  ServiceStatus,
  WorkerAvailability,
  InvitationStatus,
  type AiUrgency,
  type PrismaClient,
} from "@generated/prisma";
import { BUSINESS_TIME_ZONE } from "~/i18n/intl-locale";

/** Where the suggested price comes from, so the UI can say why. */
export type OfferPriceSource = "SERVICE" | "AI_RANGE";

/**
 * Pre-filled offer for N2: the business only confirms instead of deciding
 * every field from scratch. Every value stays editable in the form and the
 * server still validates the final submit.
 */
export type OfferDraft = {
  workerId: string | null;
  priceCents: number | null;
  priceSource: OfferPriceSource | null;
  scheduledAt: Date;
};

export type OfferDraftRequest = {
  category: string;
  aiUrgency: AiUrgency | null;
  aiMinPriceCents: number | null;
  aiMaxPriceCents: number | null;
  targetServiceId: string | null;
  suggestedServiceId: string | null;
};

const HOUR_MS = 60 * 60 * 1000;
/** Mirrors the client minimum lead time (N2: at least one hour ahead). */
const MIN_LEAD_MS = HOUR_MS;
const DEFAULT_DURATION_MINUTES = 120;
const SEARCH_HORIZON_HOURS = 7 * 24;
const PRICE_STEP_CENTS = 1_000;
/** Working window in business local time; urgent requests widen it. */
const WORK_HOURS = { start: 9, end: 18 } as const;
const URGENT_WORK_HOURS = { start: 8, end: 20 } as const;

/** Statuses that hold a worker's calendar slot. */
const SLOT_HOLDING_QUOTES: QuoteStatus[] = [
  QuoteStatus.PENDING,
  QuoteStatus.ACCEPTED,
];

const localHourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: BUSINESS_TIME_ZONE,
});

function localHour(date: Date): number {
  return Number(localHourFormatter.format(date));
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Midpoint of the AI range rounded to a friendly $10 step. */
export function aiMidpointCents(
  minCents: number | null,
  maxCents: number | null,
): number | null {
  if (minCents === null || maxCents === null || maxCents <= 0) return null;

  const mid = (minCents + maxCents) / 2;

  return Math.max(
    PRICE_STEP_CENTS,
    Math.round(mid / PRICE_STEP_CENTS) * PRICE_STEP_CENTS,
  );
}

type Slot = { start: number; end: number };

function overlaps(a: Slot, b: Slot): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * First full-hour start ≥ now + lead inside the working window that does not
 * overlap a held slot. Falls back to the first window hour when the horizon
 * is fully booked (the business can still edit it).
 */
export function nextOpenSlot(input: {
  now: number;
  durationMinutes: number;
  busy: Slot[];
  urgent: boolean;
}): Date {
  const window = input.urgent ? URGENT_WORK_HOURS : WORK_HOURS;
  const durationMs = input.durationMinutes * 60 * 1000;
  const first = Math.ceil((input.now + MIN_LEAD_MS) / HOUR_MS) * HOUR_MS;
  let fallback: number | null = null;

  for (let step = 0; step < SEARCH_HORIZON_HOURS; step += 1) {
    const start = first + step * HOUR_MS;
    const hour = localHour(new Date(start));
    const endHour = hour + input.durationMinutes / 60;

    if (hour < window.start || endHour > window.end) continue;

    fallback ??= start;
    const slot = { start, end: start + durationMs };

    if (!input.busy.some((held) => overlaps(held, slot))) {
      return new Date(start);
    }
  }

  return new Date(fallback ?? first);
}

type WorkerCandidate = {
  id: string;
  specialty: string | null;
  availability: WorkerAvailability;
  branchId: string | null;
  serviceIds: string[];
};

/**
 * Best technician for the request: skill match (linked to the matched
 * service, or specialty mentions the category) → free right now → same
 * branch → fewest held slots. Ties keep the stable name order.
 */
export function pickWorker(input: {
  workers: WorkerCandidate[];
  category: string;
  serviceId: string | null;
  branchId: string | null;
  heldSlots: Map<string, number>;
}): string | null {
  const category = normalize(input.category);
  const score = (worker: WorkerCandidate): number => {
    const skilled =
      (input.serviceId !== null &&
        worker.serviceIds.includes(input.serviceId)) ||
      (worker.specialty !== null &&
        category.length > 0 &&
        normalize(worker.specialty).includes(category));

    return (
      (skilled ? 1_000 : 0) +
      (worker.availability === WorkerAvailability.AVAILABLE ? 100 : 0) +
      (input.branchId !== null && worker.branchId === input.branchId ? 10 : 0) -
      Math.min(input.heldSlots.get(worker.id) ?? 0, 9)
    );
  };

  let best: { id: string; score: number } | null = null;

  for (const worker of input.workers) {
    const value = score(worker);
    if (best === null || value > best.score) {
      best = { id: worker.id, score: value };
    }
  }

  return best?.id ?? null;
}

/**
 * Builds the N2 offer draft for one business × request: the catalog service
 * that fits (targeted → AI-suggested → same category) sets price and
 * duration; otherwise the AI range midpoint. Worker and slot come from the
 * team's held calendar (PENDING/ACCEPTED quotes ahead).
 */
export async function buildOfferDraft(
  db: PrismaClient,
  input: {
    businessId: string;
    branchId: string | null;
    request: OfferDraftRequest;
    now?: number;
  },
): Promise<OfferDraft> {
  const now = input.now ?? Date.now();
  const { request } = input;
  const preferredIds = [
    request.targetServiceId,
    request.suggestedServiceId,
  ].filter((id): id is string => id !== null);

  const [services, workers] = await Promise.all([
    db.service.findMany({
      where: {
        businessId: input.businessId,
        status: ServiceStatus.ACTIVE,
        OR: [
          ...(preferredIds.length > 0 ? [{ id: { in: preferredIds } }] : []),
          { category: { equals: request.category, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        basePriceCents: true,
        durationMinutes: true,
      },
      orderBy: [{ basePriceCents: "asc" }, { id: "asc" }],
    }),
    db.worker.findMany({
      where: {
        businessId: input.businessId,
        invitationStatus: InvitationStatus.ACCEPTED,
      },
      select: {
        id: true,
        specialty: true,
        availability: true,
        branchId: true,
        services: { select: { id: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
  ]);

  const service =
    preferredIds
      .map((id) => services.find((candidate) => candidate.id === id))
      .find((candidate) => candidate !== undefined) ??
    services[0] ??
    null;

  const onDuty = workers.filter(
    (worker) => worker.availability !== WorkerAvailability.OFF,
  );
  const pool = onDuty.length > 0 ? onDuty : workers;

  const held =
    pool.length > 0
      ? await db.quote.findMany({
          where: {
            workerId: { in: pool.map((worker) => worker.id) },
            status: { in: SLOT_HOLDING_QUOTES },
            scheduledFor: {
              gte: new Date(now - DEFAULT_DURATION_MINUTES * 60 * 1000),
            },
          },
          select: { workerId: true, scheduledFor: true },
        })
      : [];

  const heldSlots = new Map<string, number>();
  for (const quote of held) {
    if (quote.workerId === null) continue;
    heldSlots.set(quote.workerId, (heldSlots.get(quote.workerId) ?? 0) + 1);
  }

  const workerId = pickWorker({
    workers: pool.map((worker) => ({
      id: worker.id,
      specialty: worker.specialty,
      availability: worker.availability,
      branchId: worker.branchId,
      serviceIds: worker.services.map((linked) => linked.id),
    })),
    category: request.category,
    serviceId: service?.id ?? null,
    branchId: input.branchId,
    heldSlots,
  });

  const durationMinutes = service?.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const busy = held
    .filter((quote) => quote.workerId === workerId && quote.scheduledFor)
    .map((quote) => {
      const start = quote.scheduledFor?.getTime() ?? 0;
      return { start, end: start + DEFAULT_DURATION_MINUTES * 60 * 1000 };
    });

  const aiPrice = aiMidpointCents(
    request.aiMinPriceCents,
    request.aiMaxPriceCents,
  );
  const priceCents = service?.basePriceCents ?? aiPrice;

  return {
    workerId,
    priceCents: priceCents !== null && priceCents > 0 ? priceCents : null,
    priceSource:
      service !== null ? "SERVICE" : aiPrice !== null ? "AI_RANGE" : null,
    scheduledAt: nextOpenSlot({
      now,
      durationMinutes,
      busy,
      urgent: request.aiUrgency === "HIGH",
    }),
  };
}
