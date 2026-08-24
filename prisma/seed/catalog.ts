import { ProductStatus, ServiceStatus } from "../../generated/prisma";
import type {
  Prisma,
  PrismaClient,
  Product,
  ProductStock,
  Service,
} from "../../generated/prisma";
import type { SeededBusinesses } from "./businesses";

type ServiceDefinition = {
  id: string;
  name: string;
  category: string;
  basePriceCents: number;
  durationMinutes: number;
  durationMaxMinutes: number | null;
  status: Prisma.ServiceUncheckedCreateInput["status"];
  workerIds: readonly string[];
};

type ProductDefinition = {
  id: string;
  name: string;
  sku: string;
  category: string;
  priceCents: number;
  // Public catalog image (M3-W0); most seed products stay without one so the
  // app placeholder keeps being exercised.
  imageUrl?: string;
  status: Prisma.ProductUncheckedCreateInput["status"];
};

export type SeedCatalogInput = Pick<
  SeededBusinesses,
  "garcia" | "branches" | "workers"
>;

export type SeededCatalog = {
  services: readonly [Service, Service, Service, Service];
  products: readonly Product[];
  stocks: readonly ProductStock[];
};

const productData = [
  {
    id: "seed-product-pg-001",
    name: "Fluxómetro sanitario",
    sku: "PG-001",
    category: "Sanitarios",
    priceCents: 189_900,
    imageUrl: "https://picsum.photos/seed/home360-pg-001/800/600",
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-002",
    name: "Mezcladora para lavabo",
    sku: "PG-002",
    category: "Grifería",
    priceCents: 124_900,
    imageUrl: "https://picsum.photos/seed/home360-pg-002/800/600",
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-003",
    name: "Llave angular de latón",
    sku: "PG-003",
    category: "Válvulas",
    priceCents: 15_900,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-004",
    name: "Manguera flexible reforzada",
    sku: "PG-004",
    category: "Conexiones",
    priceCents: 12_900,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-005",
    name: "Sello de cera para sanitario",
    sku: "PG-005",
    category: "Sanitarios",
    priceCents: 9_900,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-006",
    name: "Kit de reparación para WC",
    sku: "PG-006",
    category: "Refacciones",
    priceCents: 34_900,
    imageUrl: "https://picsum.photos/seed/home360-pg-006/800/600",
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-007",
    name: "Válvula check de una pulgada",
    sku: "PG-007",
    category: "Válvulas",
    priceCents: 49_900,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-008",
    name: "Cinta de teflón industrial",
    sku: "PG-008",
    category: "Consumibles",
    priceCents: 4_500,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-009",
    name: "Destapacaños manual",
    sku: "PG-009",
    category: "Herramientas",
    priceCents: 21_900,
    status: ProductStatus.PUBLISHED,
  },
  {
    id: "seed-product-pg-010",
    name: "Bomba presurizadora doméstica",
    sku: "PG-010",
    category: "Bombas",
    priceCents: 349_900,
    status: ProductStatus.DRAFT,
  },
] satisfies readonly ProductDefinition[];

const stockMatrix = [
  { sku: "PG-001", centro: 2, campestre: 14, zonaDorada: 9 },
  { sku: "PG-002", centro: 8, campestre: 7, zonaDorada: 6 },
  { sku: "PG-003", centro: 24, campestre: 18, zonaDorada: 16 },
  { sku: "PG-004", centro: 31, campestre: 27, zonaDorada: 22 },
  { sku: "PG-005", centro: 15, campestre: 12, zonaDorada: 11 },
  { sku: "PG-006", centro: 9, campestre: 10, zonaDorada: 8 },
  { sku: "PG-007", centro: 7, campestre: 8, zonaDorada: 6 },
  { sku: "PG-008", centro: 45, campestre: 38, zonaDorada: 29 },
  { sku: "PG-009", centro: 6, campestre: 7, zonaDorada: 8 },
  { sku: "PG-010", centro: 3, campestre: 4, zonaDorada: null },
] as const;

export async function seedCatalog(
  prisma: PrismaClient,
  { garcia, branches, workers }: SeedCatalogInput,
): Promise<SeededCatalog> {
  const serviceData = [
    {
      id: "seed-service-leak-repair",
      name: "Reparación de fugas",
      category: "Plomería",
      basePriceCents: 85_000,
      durationMinutes: 60,
      durationMaxMinutes: 120,
      status: ServiceStatus.ACTIVE,
      workerIds: [workers.plumber.id],
    },
    {
      id: "seed-service-drain-cleaning",
      name: "Destape de drenaje",
      category: "Plomería",
      basePriceCents: 120_000,
      durationMinutes: 90,
      durationMaxMinutes: 180,
      status: ServiceStatus.ACTIVE,
      workerIds: [workers.plumber.id],
    },
    {
      id: "seed-service-water-heater",
      name: "Instalación de calentador",
      category: "Plomería",
      basePriceCents: 220_000,
      durationMinutes: 180,
      durationMaxMinutes: 300,
      status: ServiceStatus.ACTIVE,
      workerIds: [workers.plumber.id, workers.courier.id],
    },
    {
      id: "seed-service-fixture-installation",
      name: "Instalación de sanitario",
      category: "Plomería",
      basePriceCents: 165_000,
      durationMinutes: 120,
      durationMaxMinutes: 240,
      status: ServiceStatus.ACTIVE,
      workerIds: [workers.plumber.id, workers.courier.id],
    },
  ] satisfies readonly ServiceDefinition[];

  const services = await Promise.all(
    serviceData.map(({ id, workerIds, ...values }) =>
      prisma.service.upsert({
        where: { id },
        create: {
          id,
          ...values,
          business: { connect: { id: garcia.id } },
          workers: { connect: workerIds.map((workerId) => ({ id: workerId })) },
        },
        update: {
          ...values,
          business: { connect: { id: garcia.id } },
          workers: { set: workerIds.map((workerId) => ({ id: workerId })) },
        },
      }),
    ),
  );

  const [leakRepair, drainCleaning, waterHeater, fixtureInstallation] =
    services;
  if (!leakRepair || !drainCleaning || !waterHeater || !fixtureInstallation) {
    throw new Error("Seed services could not be created");
  }

  const products = await Promise.all(
    productData.map(({ id, sku, ...values }) =>
      prisma.product.upsert({
        where: { businessId_sku: { businessId: garcia.id, sku } },
        create: { id, sku, businessId: garcia.id, ...values },
        update: values,
      }),
    ),
  );

  const productsBySku = new Map(
    products.map((product) => [product.sku, product] as const),
  );
  const seededBranches = [
    { key: "centro", branch: branches.centro },
    { key: "campestre", branch: branches.campestre },
    { key: "zonaDorada", branch: branches.zonaDorada },
  ] as const;
  const stockData: Prisma.ProductStockUncheckedCreateInput[] = [];

  for (const stockRow of stockMatrix) {
    const product = productsBySku.get(stockRow.sku);
    if (!product) {
      throw new Error("Seed product stock could not be created");
    }

    for (const { key, branch } of seededBranches) {
      const stock = stockRow[key];
      if (stock === null) continue;

      stockData.push({
        id: `seed-stock-${stockRow.sku.toLowerCase()}-${key.toLowerCase()}`,
        productId: product.id,
        branchId: branch.id,
        stock,
        lowStockThreshold: 5,
      });
    }
  }

  const stocks = await Promise.all(
    stockData.map(({ id, productId, branchId, stock, lowStockThreshold }) =>
      prisma.productStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { id, productId, branchId, stock, lowStockThreshold },
        update: { stock, lowStockThreshold },
      }),
    ),
  );

  return {
    services: [leakRepair, drainCleaning, waterHeater, fixtureInstallation],
    products,
    stocks,
  };
}
