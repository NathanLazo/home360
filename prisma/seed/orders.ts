import {
  DisputeStatus,
  DisputeUrgency,
  OrderStatus,
  OrderType,
} from "../../generated/prisma";
import type {
  Dispute,
  Order,
  OrderMaterial,
  Prisma,
  PrismaClient,
  Review,
} from "../../generated/prisma";
import { recalculateBusinessRating } from "../../src/server/services/reviews/business-rating";
import type { SeededBusinesses } from "./businesses";
import type { SeededCatalog } from "./catalog";
import type { SeededMarketplace } from "./marketplace";
import type { SeededUsers } from "./users";

export type SeedOrdersInput = {
  users: Pick<SeededUsers, "customers">;
  businesses: Pick<SeededBusinesses, "garcia" | "branches">;
  catalog: Pick<SeededCatalog, "services" | "products">;
  marketplace: Pick<SeededMarketplace, "acceptedQuote">;
};

export type SeededOrders = {
  orders: readonly Order[];
  acceptedQuoteOrder: Order;
  disputes: readonly [Dispute, Dispute];
  reviews: readonly Review[];
  materials: readonly OrderMaterial[];
};

function daysAgo(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1_000);
}

export async function seedOrders(
  prisma: PrismaClient,
  { users, businesses, catalog, marketplace }: SeedOrdersInput,
): Promise<SeededOrders> {
  const now = new Date();
  const [leakRepair, drainCleaning, waterHeater, fixtureInstallation] =
    catalog.services;
  const [
    fluxometer,
    faucet,
    angleValve,
    flexibleHose,
    waxSeal,
    repairKit,
    checkValve,
    teflonTape,
  ] = catalog.products;

  if (
    !fluxometer ||
    !faucet ||
    !angleValve ||
    !flexibleHose ||
    !waxSeal ||
    !repairKit ||
    !checkValve ||
    !teflonTape
  ) {
    throw new Error("Seed order products are not configured");
  }

  const orderData = [
    {
      id: "seed-order-01",
      type: OrderType.SERVICE,
      title: "Reparación de fuga en cocina",
      status: OrderStatus.COMPLETED,
      amountCents: leakRepair.basePriceCents,
      customerId: users.customers[0].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      serviceId: leakRepair.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-01-recording.mp4",
      recordingDurationSec: 842,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-01-before.jpg"],
      afterUrls: ["https://example.com/seed/order-01-after.jpg"],
      workNotes: "Se reemplazó la conexión flexible y se verificó presión.",
      createdAt: daysAgo(now, 56),
    },
    {
      id: "seed-order-02",
      type: OrderType.PRODUCT,
      title: "Mezcladoras para lavabo",
      status: OrderStatus.COMPLETED,
      amountCents: faucet.priceCents * 2,
      customerId: users.customers[1].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      serviceId: null,
      productId: faucet.id,
      quoteId: null,
      corporateAccountId: null,
      quantity: 2,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 51),
    },
    {
      id: "seed-order-03",
      type: OrderType.SERVICE,
      title: "Destape urgente de drenaje",
      status: OrderStatus.DISPUTED,
      amountCents: drainCleaning.basePriceCents,
      customerId: users.customers[2].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.zonaDorada.id,
      serviceId: drainCleaning.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-03-recording.mp4",
      recordingDurationSec: 318,
      recordingComplete: false,
      beforeUrls: ["https://example.com/seed/order-03-before.jpg"],
      afterUrls: [],
      workNotes: "La grabación terminó antes de documentar el resultado.",
      createdAt: daysAgo(now, 45),
    },
    {
      id: "seed-order-04",
      type: OrderType.SERVICE,
      title: "Instalación de sanitario",
      status: OrderStatus.COMPLETED,
      amountCents: fixtureInstallation.basePriceCents,
      customerId: users.customers[3].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      serviceId: fixtureInstallation.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-04-recording.mp4",
      recordingDurationSec: 4_125,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-04-before.jpg"],
      afterUrls: ["https://example.com/seed/order-04-after.jpg"],
      workNotes: "Instalación terminada y prueba de descarga satisfactoria.",
      createdAt: daysAgo(now, 39),
    },
    {
      id: "seed-order-05",
      type: OrderType.PRODUCT,
      title: "Llaves angulares de latón",
      status: OrderStatus.SHIPPING,
      amountCents: angleValve.priceCents * 3,
      customerId: users.customers[4].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      serviceId: null,
      productId: angleValve.id,
      quoteId: null,
      corporateAccountId: null,
      quantity: 3,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 34),
    },
    {
      id: "seed-order-06",
      type: OrderType.SERVICE,
      title: "Instalación de calentador de agua",
      status: OrderStatus.IN_PROGRESS,
      amountCents: marketplace.acceptedQuote.amountCents,
      customerId: users.customers[1].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      serviceId: waterHeater.id,
      productId: null,
      quoteId: marketplace.acceptedQuote.id,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: ["https://example.com/seed/order-06-before.jpg"],
      afterUrls: [],
      workNotes: "Servicio en curso.",
      createdAt: daysAgo(now, 29),
    },
    {
      id: "seed-order-07",
      type: OrderType.PRODUCT,
      title: "Kit de reparación para WC",
      status: OrderStatus.PAID,
      amountCents: repairKit.priceCents,
      customerId: users.customers[0].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.zonaDorada.id,
      serviceId: null,
      productId: repairKit.id,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 24),
    },
    {
      id: "seed-order-08",
      type: OrderType.SERVICE,
      title: "Revisión de fuga en baño",
      status: OrderStatus.CANCELLED,
      amountCents: leakRepair.basePriceCents,
      customerId: users.customers[2].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      serviceId: leakRepair.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: "Cancelada antes de iniciar el servicio.",
      createdAt: daysAgo(now, 20),
    },
    {
      id: "seed-order-09",
      type: OrderType.SERVICE,
      title: "Instalación de calentador",
      status: OrderStatus.COMPLETED,
      amountCents: waterHeater.basePriceCents,
      customerId: users.customers[3].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      serviceId: waterHeater.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-09-recording.mp4",
      recordingDurationSec: 5_208,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-09-before.jpg"],
      afterUrls: ["https://example.com/seed/order-09-after.jpg"],
      workNotes: "Equipo instalado, purgado y probado.",
      createdAt: daysAgo(now, 15),
    },
    {
      id: "seed-order-10",
      type: OrderType.PRODUCT,
      title: "Cinta de teflón industrial",
      status: OrderStatus.COMPLETED,
      amountCents: teflonTape.priceCents * 2,
      customerId: users.customers[4].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.zonaDorada.id,
      serviceId: null,
      productId: teflonTape.id,
      quoteId: null,
      corporateAccountId: null,
      quantity: 2,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 12),
    },
    {
      id: "seed-order-11",
      type: OrderType.SERVICE,
      title: "Instalación de sanitario con aclaración",
      status: OrderStatus.DISPUTED,
      amountCents: fixtureInstallation.basePriceCents,
      customerId: users.customers[0].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      serviceId: fixtureInstallation.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-11-recording.mp4",
      recordingDurationSec: 3_902,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-11-before.jpg"],
      afterUrls: ["https://example.com/seed/order-11-after.jpg"],
      workNotes: "Trabajo concluido; el cliente reporta movimiento en la base.",
      createdAt: daysAgo(now, 9),
    },
    {
      id: "seed-order-12",
      type: OrderType.SERVICE,
      title: "Diagnóstico de baja presión",
      status: OrderStatus.PENDING,
      amountCents: leakRepair.basePriceCents,
      customerId: users.customers[1].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.zonaDorada.id,
      serviceId: leakRepair.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 6),
    },
    {
      id: "seed-order-13",
      type: OrderType.SERVICE,
      title: "Limpieza preventiva de drenaje",
      status: OrderStatus.COMPLETED,
      amountCents: drainCleaning.basePriceCents,
      customerId: users.customers[2].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.campestre.id,
      serviceId: drainCleaning.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-13-recording.mp4",
      recordingDurationSec: 2_188,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-13-before.jpg"],
      afterUrls: ["https://example.com/seed/order-13-after.jpg"],
      workNotes: "Flujo restablecido y tubería verificada.",
      createdAt: daysAgo(now, 4),
    },
    {
      id: "seed-order-14",
      type: OrderType.PRODUCT,
      title: "Válvulas check",
      status: OrderStatus.COMPLETED,
      amountCents: checkValve.priceCents * 2,
      customerId: users.customers[3].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.centro.id,
      serviceId: null,
      productId: checkValve.id,
      quoteId: null,
      corporateAccountId: null,
      quantity: 2,
      recordingUrl: null,
      recordingDurationSec: null,
      recordingComplete: false,
      beforeUrls: [],
      afterUrls: [],
      workNotes: null,
      createdAt: daysAgo(now, 2),
    },
    {
      id: "seed-order-15",
      type: OrderType.SERVICE,
      title: "Cambio de manguera flexible",
      status: OrderStatus.COMPLETED,
      amountCents: leakRepair.basePriceCents,
      customerId: users.customers[4].id,
      businessId: businesses.garcia.id,
      branchId: businesses.branches.zonaDorada.id,
      serviceId: leakRepair.id,
      productId: null,
      quoteId: null,
      corporateAccountId: null,
      quantity: 1,
      recordingUrl: "https://example.com/seed/order-15-recording.mp4",
      recordingDurationSec: 1_104,
      recordingComplete: true,
      beforeUrls: ["https://example.com/seed/order-15-before.jpg"],
      afterUrls: ["https://example.com/seed/order-15-after.jpg"],
      workNotes: "Conexión sustituida sin fugas posteriores.",
      createdAt: daysAgo(now, 1),
    },
  ] satisfies readonly Prisma.OrderUncheckedCreateInput[];

  const orders = await prisma.$transaction(
    orderData.map(({ id, ...values }) =>
      prisma.order.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const acceptedQuoteOrder = orders.find(
    (order) => order.quoteId === marketplace.acceptedQuote.id,
  );
  if (!acceptedQuoteOrder) {
    throw new Error("Seed accepted quote order could not be created");
  }

  const materialData = [
    {
      id: "seed-material-order-01-hose",
      orderId: "seed-order-01",
      productId: flexibleHose.id,
      name: flexibleHose.name,
      quantity: 1,
      unitPriceCents: flexibleHose.priceCents,
    },
    {
      id: "seed-material-order-01-tape",
      orderId: "seed-order-01",
      productId: teflonTape.id,
      name: teflonTape.name,
      quantity: 1,
      unitPriceCents: teflonTape.priceCents,
    },
    {
      id: "seed-material-order-11-seal",
      orderId: "seed-order-11",
      productId: waxSeal.id,
      name: waxSeal.name,
      quantity: 1,
      unitPriceCents: waxSeal.priceCents,
    },
    {
      id: "seed-material-order-11-tape",
      orderId: "seed-order-11",
      productId: teflonTape.id,
      name: teflonTape.name,
      quantity: 1,
      unitPriceCents: teflonTape.priceCents,
    },
  ] satisfies readonly Prisma.OrderMaterialUncheckedCreateInput[];

  const materials = await prisma.$transaction(
    materialData.map(({ id, ...values }) =>
      prisma.orderMaterial.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const disputeData = [
    {
      id: "seed-dispute-urgent",
      orderId: "seed-order-03",
      businessId: businesses.garcia.id,
      title: "Grabación incompleta y drenaje aún obstruido",
      urgency: DisputeUrgency.URGENT,
      status: DisputeStatus.OPEN,
      customerArgument:
        "El drenaje volvió a obstruirse y falta evidencia final.",
      businessArgument: "Se realizó el procedimiento acordado antes del corte.",
      evidenceUrls: [
        "https://example.com/seed/dispute-urgent-photo.jpg",
        "https://example.com/seed/order-03-recording.mp4",
      ],
      aiSummary:
        "La evidencia no documenta el resultado final; requiere revisión prioritaria.",
      resolution: null,
      resolutionAmountCents: null,
      resolvedAt: null,
    },
    {
      id: "seed-dispute-normal",
      orderId: "seed-order-11",
      businessId: businesses.garcia.id,
      title: "Sanitario presenta movimiento",
      urgency: DisputeUrgency.NORMAL,
      status: DisputeStatus.OPEN,
      customerArgument:
        "La base se mueve ligeramente después de la instalación.",
      businessArgument: null,
      evidenceUrls: [
        "https://example.com/seed/order-11-before.jpg",
        "https://example.com/seed/order-11-after.jpg",
        "https://example.com/seed/order-11-recording.mp4",
      ],
      aiSummary: null,
      resolution: null,
      resolutionAmountCents: null,
      resolvedAt: null,
    },
  ] satisfies readonly Prisma.DisputeUncheckedCreateInput[];

  const disputes = await prisma.$transaction(
    disputeData.map(({ id, orderId, ...values }) =>
      prisma.dispute.upsert({
        where: { orderId },
        create: { id, orderId, ...values },
        update: values,
      }),
    ),
  );

  const [urgentDispute, normalDispute] = disputes;
  if (!urgentDispute || !normalDispute) {
    throw new Error("Seed disputes could not be created");
  }

  const completedOrders = [
    orders[0],
    orders[1],
    orders[3],
    orders[8],
    orders[9],
    orders[12],
    orders[13],
    orders[14],
  ].filter((order): order is Order => order !== undefined);
  if (completedOrders.length !== 8) {
    throw new Error("Seed review orders could not be created");
  }

  const reviewData: Prisma.ReviewUncheckedCreateInput[] = completedOrders.map(
    (order, index) => ({
      id: `seed-review-${String(index + 1).padStart(2, "0")}`,
      orderId: order.id,
      customerId: order.customerId,
      rating: index === 3 ? 4 : 5,
      comment:
        index === 3
          ? "Buen servicio; la llegada tomó más tiempo del esperado."
          : "Excelente atención y resultado.",
    }),
  );

  const reviews = await prisma.$transaction(
    reviewData.map(({ id, orderId, ...values }) =>
      prisma.review.upsert({
        where: { orderId },
        create: { id, orderId, ...values },
        update: values,
      }),
    ),
  );

  // Full recalculation (never increments) keeps the seed idempotent: all seed
  // reviews belong to García orders, so García is the only business to sync.
  await recalculateBusinessRating(prisma, businesses.garcia.id);

  return {
    orders,
    acceptedQuoteOrder,
    disputes: [urgentDispute, normalDispute],
    reviews,
    materials,
  };
}
