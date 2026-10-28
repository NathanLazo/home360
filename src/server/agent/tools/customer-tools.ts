import { tool } from "ai";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";
import { REQUEST_CATEGORIES } from "~/schemas/marketplace/request-categories";
import { runTool, type AgentCaller } from "../tool-runtime";

/**
 * Mobile customer concierge catalog (Don Víctor). Every tool delegates to the
 * customer tRPC procedures (RBAC, ownership and validation stay there) and
 * maps their payload to the compact shapes the app renders. Tool names and
 * output shapes are a contract with `home360-app`: do not rename them.
 * There are no delete or payment tools: paying happens in the app.
 */

/** Envelope every procedure returns (`TrpcResponse`), error side widened. */
type Envelope<T> = {
  result: T | null;
  error: string | null;
  status: number;
  message: string;
};

/** Keeps a failure as-is and maps the payload of a success. */
function mapEnvelope<T, U>(
  response: Envelope<T>,
  map: (result: T) => U,
): Envelope<U> {
  if (response.result === null) {
    return {
      result: null,
      error: response.error ?? "INTERNAL_ERROR",
      status: response.status,
      message: response.message,
    };
  }

  return {
    result: map(response.result),
    error: null,
    status: response.status,
    message: response.message,
  };
}

function toolFailure(
  error: string,
  status: number,
  message: string,
): Envelope<never> {
  return { result: null, error, status, message };
}

/** Same cap as `request.create` / `request.diagnose`. */
const MAX_MEDIA = 5;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/** Business directory pages scanned when the model filters by text. */
const MAX_DIRECTORY_PAGES = 3;

const limitSchema = z.number().int().min(1).max(MAX_LIMIT).optional();

const mediaPathnamesSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(MAX_MEDIA);

/** Only request photos/videos feed the diagnosis and the request itself. */
function isRequestMedia(pathname: string): boolean {
  const kind = pathname.split("/")[1];
  return kind === "requestPhoto" || kind === "requestVideo";
}

/** Case and accent insensitive text match ("plomeria" finds "Plomería"). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

type AddressRow = {
  id: string;
  label: string;
  addressLine: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

function toAddress(address: AddressRow) {
  return {
    id: address.id,
    label: address.label,
    addressLine: address.addressLine,
    neighborhood: address.neighborhood,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

export function createCustomerTools(caller: AgentCaller) {
  /** Default address id (or the newest one) for requests without `addressId`. */
  async function defaultAddressId(): Promise<string | null> {
    const list = await caller.address.list();
    const addresses = list.result ?? [];
    return (
      addresses.find((address) => address.isDefault)?.id ??
      addresses[0]?.id ??
      null
    );
  }

  return {
    getMyContext: tool({
      description:
        "Signed-in customer: name, email, default address (label, neighborhood/colonia, coordinates) and every saved address. Call it before confirming where a project happens.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(async () => {
          const [me, addresses] = await Promise.all([
            caller.auth.me(),
            caller.address.list(),
          ]);

          if (me.result === null) {
            return mapEnvelope(me, () => null);
          }

          const user = me.result;

          return mapEnvelope(addresses, (rows) => {
            const items = rows.map(toAddress);
            const defaultRow =
              rows.find((address) => address.isDefault) ?? rows[0] ?? null;

            return {
              name: user.name,
              email: user.email,
              defaultAddress: defaultRow ? toAddress(defaultRow) : null,
              addresses: items,
            };
          });
        }),
    }),

    searchBusinesses: tool({
      description:
        "ACTIVE businesses nearest to the customer's default address first. `query` matches business name, category or what they sell; `category` is an exact marketplace category (Plomería, Eléctrico, Pintura, Carpintería, Limpieza, Jardinería, Clima, Otro).",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(100).optional(),
        category: z.string().trim().min(1).max(60).optional(),
        limit: limitSchema,
      }),
      execute: ({ query, category, limit }) =>
        runTool(async () => {
          const max = limit ?? DEFAULT_LIMIT;
          const needle = query ? normalize(query) : null;
          // Businesses whose services/products match the text also count.
          const sellerIds = new Set<string>();

          if (query) {
            const search = await caller.marketplace.search({ query });

            for (const item of search.result?.items ?? []) {
              sellerIds.add(item.businessId);
            }
          }

          const first = await caller.marketplace.listBusinesses({ category });

          if (first.result === null) {
            return mapEnvelope(first, () => null);
          }

          const rows = [...first.result.items];
          let cursor = first.result.nextCursor;
          let pages = 1;

          while (needle && cursor && pages < MAX_DIRECTORY_PAGES) {
            const next = await caller.marketplace.listBusinesses({
              category,
              cursor,
            });
            rows.push(...(next.result?.items ?? []));
            cursor = next.result?.nextCursor ?? null;
            pages += 1;
          }

          const matches = needle
            ? rows.filter(
                (row) =>
                  sellerIds.has(row.id) ||
                  normalize(row.name).includes(needle) ||
                  row.categories.some((value) =>
                    normalize(value).includes(needle),
                  ),
              )
            : rows;

          return mapEnvelope(first, () => ({
            items: matches.slice(0, max).map((row) => ({
              id: row.id,
              name: row.name,
              category: row.categories[0] ?? null,
              distanceKm: row.distanceKm,
              rating: row.ratingAvg,
              logoUrl: row.coverUrl,
            })),
          }));
        }),
    }),

    searchProducts: tool({
      description:
        "Published marketplace products whose name matches `query` (materials, parts, appliances). Prices are MXN cents.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(100),
        limit: limitSchema,
      }),
      execute: ({ query, limit }) =>
        runTool(async () => {
          const search = await caller.marketplace.search({
            query,
            kind: "product",
          });

          return mapEnvelope(search, (result) => ({
            items: result.items
              .slice(0, limit ?? DEFAULT_LIMIT)
              .map((item) => ({
                id: item.id,
                name: item.name,
                priceCents: item.priceCents,
                businessName: item.businessName,
                imageUrl: item.imageUrl,
              })),
          }));
        }),
    }),

    listBusinessServices: tool({
      description:
        "Active services of one business (id from searchBusinesses) with their starting price in MXN cents and duration.",
      inputSchema: z.object({ businessId: recordIdSchema }),
      execute: ({ businessId }) =>
        runTool(async () => {
          const business = await caller.marketplace.getBusiness({
            id: businessId,
          });

          return mapEnvelope(business, (result) => ({
            items: result.services.map((service) => ({
              id: service.id,
              name: service.name,
              fromPriceCents: service.basePriceCents,
              durationMin: service.durationMinutes,
            })),
          }));
        }),
    }),

    diagnoseProject: tool({
      description:
        "AI diagnosis of the customer's project from the photos/videos they attached (mediaPathname values of the attachment notes whose path contains /requestPhoto/ or /requestVideo/). Returns a diagnosisId reusable by createProjectRequest for 24 h, the diagnosis text, confidence, category, urgency and a price range in MXN cents. AI_UNAVAILABLE means: ask the customer to describe it and pick a category instead.",
      inputSchema: z.object({
        mediaPathnames: mediaPathnamesSchema.min(1),
        description: z.string().trim().max(1_000).optional(),
      }),
      execute: ({ mediaPathnames, description }) =>
        runTool(async () => {
          const usable = mediaPathnames.filter(isRequestMedia);

          if (usable.length === 0) {
            return toolFailure(
              "VALIDATION_ERROR",
              422,
              "Only project photos or videos (requestPhoto/requestVideo) can be diagnosed. Documents are context only.",
            );
          }

          const diagnosed = await caller.request.diagnose({
            mediaPathnames: usable,
            description,
          });

          return mapEnvelope(diagnosed, (result) => ({
            diagnosisId: result.diagnosisId,
            diagnosis: result.diagnosis,
            confidencePct: result.confidencePct,
            category: result.category,
            urgency: result.urgency,
            minPriceCents: result.minPriceCents,
            maxPriceCents: result.maxPriceCents,
          }));
        }),
    }),

    createProjectRequest: tool({
      description:
        "Publishes the customer's project as a service request so nearby businesses send quotes. MONEY-FREE, but REQUIRES EXPLICIT USER CONFIRMATION IN A PREVIOUS TURN: first show the summary (what, category, price range, address) and ask; call this only after the customer clearly says yes. Use `diagnosisId` from diagnoseProject, or a manual `category` (never both). Without `addressId` the customer's default address is used. `businessId`/`serviceId` aim the request at one business only.",
      inputSchema: z.object({
        diagnosisId: recordIdSchema.optional(),
        category: z.enum(REQUEST_CATEGORIES).optional(),
        description: z.string().trim().min(1).max(1_000),
        mediaPathnames: mediaPathnamesSchema.optional(),
        addressId: recordIdSchema.optional(),
        businessId: recordIdSchema.optional(),
        serviceId: recordIdSchema.optional(),
      }),
      execute: (input) =>
        runTool(async () => {
          if (input.diagnosisId !== undefined && input.category !== undefined) {
            return toolFailure(
              "VALIDATION_ERROR",
              422,
              "Use a diagnosisId or a category, not both.",
            );
          }

          const mediaPathnames = (input.mediaPathnames ?? []).filter(
            isRequestMedia,
          );

          if (
            input.diagnosisId === undefined &&
            input.category === undefined &&
            mediaPathnames.length === 0
          ) {
            return toolFailure(
              "VALIDATION_ERROR",
              422,
              "A diagnosisId, a category or project photos are required.",
            );
          }

          const addressId = input.addressId ?? (await defaultAddressId());

          if (!addressId) {
            return toolFailure(
              "ADDRESS_REQUIRED",
              422,
              "The customer has no saved address. Ask them to add one in the app (suggestAddress helps find it).",
            );
          }

          const created = await caller.request.create({
            diagnosisId: input.diagnosisId,
            category: input.category,
            description: input.description,
            mediaPathnames,
            addressId,
            businessId: input.businessId,
            serviceId: input.serviceId,
          });

          return mapEnvelope(created, (result) => ({
            id: result.request.id,
            title: result.request.title,
            category: result.request.category,
            status: result.request.status,
          }));
        }),
    }),

    listMyRequests: tool({
      description:
        "The customer's service requests, newest first, with status and how many pending quotes each has.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(async () => {
          const list = await caller.request.listMine();

          return mapEnvelope(list, (result) => ({
            items: result.items.map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              quotesCount: item.pendingQuoteCount,
              createdAt: item.createdAt,
            })),
          }));
        }),
    }),

    getRequestQuotes: tool({
      description:
        "Pending quotes of one of the customer's requests (id from listMyRequests), recommended first. Amounts are MXN cents; accepting and paying happen in the app.",
      inputSchema: z.object({ requestId: recordIdSchema }),
      execute: ({ requestId }) =>
        runTool(async () => {
          const quotes = await caller.quote.listByRequest({ requestId });

          return mapEnvelope(quotes, (items) => ({
            items: items.map((quote) => ({
              id: quote.id,
              businessName: quote.business.name,
              amountCents: quote.amountCents,
              message: quote.message,
            })),
          }));
        }),
    }),

    suggestAddress: tool({
      description:
        "Address autocomplete (Mexico, biased to Chihuahua): returns place suggestions for a typed address so the customer can save it in the app. GEO_UNAVAILABLE means autocomplete is offline: ask for the address in words.",
      inputSchema: z.object({
        query: z.string().trim().min(3).max(200),
      }),
      execute: ({ query }) => runTool(() => caller.geo.suggest({ query })),
    }),
  };
}
