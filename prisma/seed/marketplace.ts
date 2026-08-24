import { AiUrgency, QuoteStatus, RequestStatus } from "../../generated/prisma";
import type {
  Prisma,
  PrismaClient,
  Quote,
  ServiceRequest,
} from "../../generated/prisma";
import type { SeededBusinesses } from "./businesses";
import type { SeededUsers } from "./users";

export type SeedMarketplaceInput = {
  users: Pick<SeededUsers, "customers">;
  businesses: Pick<
    SeededBusinesses,
    "garcia" | "volta" | "clima" | "branches" | "workers"
  >;
};

export type SeededMarketplace = {
  openRequest: ServiceRequest;
  acceptedRequest: ServiceRequest;
  openQuotes: readonly [Quote, Quote, Quote];
  acceptedQuote: Quote;
};

export async function seedMarketplace(
  prisma: PrismaClient,
  { users, businesses }: SeedMarketplaceInput,
): Promise<SeededMarketplace> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 5);

  const requestData = [
    {
      id: "seed-request-open",
      customerId: users.customers[0].id,
      title: "Fuga bajo el fregadero",
      description: "La tubería pierde agua al abrir la llave de la cocina.",
      category: "Plomería",
      photoUrls: ["https://example.com/seed/request-open-faucet.jpg"],
      aiConfidencePct: 92,
      aiDiagnosis: "Conexión flexible o empaque deteriorado.",
      aiMinPriceCents: 65_000,
      aiMaxPriceCents: 110_000,
      aiUrgency: AiUrgency.MEDIUM,
      addressLine: "Av. Universidad 2500, Chihuahua, Chih.",
      latitude: 28.6516,
      longitude: -106.0889,
      status: RequestStatus.OPEN,
      expiresAt,
      createdAt: now,
    },
    {
      id: "seed-request-accepted",
      customerId: users.customers[1].id,
      title: "Instalación de calentador de agua",
      description:
        "Se requiere retiro del equipo anterior e instalación completa.",
      category: "Plomería",
      photoUrls: ["https://example.com/seed/request-accepted-heater.jpg"],
      aiConfidencePct: 88,
      aiDiagnosis: "Instalación estándar con adecuación de conexiones.",
      aiMinPriceCents: 190_000,
      aiMaxPriceCents: 260_000,
      aiUrgency: AiUrgency.LOW,
      addressLine: "Paseo Bolívar 601, Chihuahua, Chih.",
      latitude: 28.6387,
      longitude: -106.0768,
      status: RequestStatus.ACCEPTED,
      expiresAt: null,
      createdAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1_000),
    },
  ] satisfies readonly Prisma.ServiceRequestUncheckedCreateInput[];

  const requests = await prisma.$transaction(
    requestData.map(({ id, ...values }) =>
      prisma.serviceRequest.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const [openRequest, acceptedRequest] = requests;
  if (!openRequest || !acceptedRequest) {
    throw new Error("Seed marketplace requests could not be created");
  }

  const quoteData = [
    {
      id: "seed-quote-open-garcia",
      requestId: openRequest.id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      workerId: businesses.workers.plumber.id,
      amountCents: 82_000,
      message: "Diagnóstico y reparación con materiales básicos incluidos.",
      scheduledFor: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000),
      status: QuoteStatus.PENDING,
    },
    {
      id: "seed-quote-open-volta",
      requestId: openRequest.id,
      businessId: businesses.volta.id,
      branchId: null,
      workerId: null,
      amountCents: 89_000,
      message: "Visita técnica y reparación sujeta a diagnóstico.",
      scheduledFor: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1_000),
      status: QuoteStatus.PENDING,
    },
    {
      id: "seed-quote-open-clima",
      requestId: openRequest.id,
      businessId: businesses.clima.id,
      branchId: null,
      workerId: null,
      amountCents: 95_000,
      message: "Atención programada con revisión de conexiones.",
      scheduledFor: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1_000),
      status: QuoteStatus.PENDING,
    },
    {
      id: "seed-quote-accepted-garcia",
      requestId: acceptedRequest.id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      workerId: businesses.workers.plumber.id,
      amountCents: 220_000,
      message:
        "Instalación, retiro del equipo anterior y prueba de funcionamiento.",
      scheduledFor: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1_000),
      status: QuoteStatus.ACCEPTED,
    },
  ] satisfies readonly Prisma.QuoteUncheckedCreateInput[];

  const quotes = await prisma.$transaction(
    quoteData.map(({ id, requestId, businessId, ...values }) =>
      prisma.quote.upsert({
        where: { requestId_businessId: { requestId, businessId } },
        create: { id, requestId, businessId, ...values },
        update: values,
      }),
    ),
  );

  const [garciaQuote, voltaQuote, climaQuote, acceptedQuote] = quotes;
  if (!garciaQuote || !voltaQuote || !climaQuote || !acceptedQuote) {
    throw new Error("Seed marketplace quotes could not be created");
  }

  return {
    openRequest,
    acceptedRequest,
    openQuotes: [garciaQuote, voltaQuote, climaQuote],
    acceptedQuote,
  };
}
