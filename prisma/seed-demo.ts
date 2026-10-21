/**
 * Demo marketplace for QA (Chihuahua): businesses of every kind with
 * branches, services, products and stock, workers, customers with
 * addresses, requests in every status with quotes, orders across the whole
 * lifecycle (escrow, delivery, pickup, completed + reviews) and chats.
 *
 * Idempotent: every row has a stable `demo-*` id (users are keyed by email)
 * and is upserted with `update: {}`, so re-running never duplicates nor
 * overwrites what testers changed. Payments in escrow have no
 * `escrowReleaseAt`, so the release cron never touches them.
 *
 *   POSTGRES_PRISMA_URL=... pnpm db:seed:demo
 */
import bcrypt from "bcryptjs";

import {
  AiUrgency,
  BranchStatus,
  BusinessStatus,
  BusinessType,
  CommissionSource,
  FulfillmentMethod,
  GuaranteeType,
  InvitationStatus,
  MessageType,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  QuoteStatus,
  RequestStatus,
  ServiceStatus,
  SubscriptionStatus,
  UserRole,
  WorkerAvailability,
} from "../generated/prisma";

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "Demo360!";
const EMAIL_DOMAIN = "demo.home360.lat";
const SERVICE_FEE_CENTS = 2500;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);
const image = (tag: string, lock: number) =>
  `https://loremflickr.com/640/640/${tag}?lock=${lock}`;

type BranchSeed = {
  key: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickup?: boolean;
  delivery?: boolean;
  paused?: boolean;
};

type ServiceSeed = {
  key: string;
  name: string;
  category: string;
  price: number;
  minutes: number;
  maxMinutes?: number;
  paused?: boolean;
};

type ProductSeed = {
  key: string;
  name: string;
  category: string;
  price: number;
  tag: string;
  /** Units per branch key; missing branches carry no stock row. */
  stock: Record<string, number>;
  draft?: boolean;
};

type WorkerSeed = {
  key: string;
  fullName: string;
  specialty: string;
  branch: string;
  /** Gets a WORKER login. */
  login?: boolean;
  /** Invitation still pending (no account yet). */
  invited?: boolean;
  availability?: WorkerAvailability;
};

type BusinessSeed = {
  key: string;
  name: string;
  owner: string;
  type: BusinessType;
  status?: BusinessStatus;
  plan: "basic" | "standard" | "enterprise" | null;
  rating: [number, number] | null;
  branches: BranchSeed[];
  services: ServiceSeed[];
  products: ProductSeed[];
  workers: WorkerSeed[];
};

const BUSINESSES: BusinessSeed[] = [
  {
    key: "plomeria-norte",
    name: "Plomería Express Norte",
    owner: "Ricardo Fuentes",
    type: BusinessType.MIXED,
    plan: "standard",
    rating: [4.8, 37],
    branches: [
      {
        key: "centro",
        name: "Matriz Centro",
        address: "Av. Independencia 1204, Centro",
        lat: 28.6353,
        lng: -106.0889,
      },
      {
        key: "norte",
        name: "Sucursal Norte",
        address: "Av. Tecnológico 4510, Las Granjas",
        lat: 28.6702,
        lng: -106.0864,
      },
    ],
    services: [
      {
        key: "fuga",
        name: "Reparación de fuga de agua",
        category: "Plomería",
        price: 65000,
        minutes: 60,
        maxMinutes: 120,
      },
      {
        key: "destape",
        name: "Destape de drenaje",
        category: "Plomería",
        price: 85000,
        minutes: 90,
      },
      {
        key: "boiler",
        name: "Instalación de boiler",
        category: "Plomería",
        price: 180000,
        minutes: 180,
        maxMinutes: 240,
      },
      {
        key: "wc",
        name: "Cambio de WC",
        category: "Plomería",
        price: 120000,
        minutes: 120,
      },
    ],
    products: [
      {
        key: "llave",
        name: "Llave mezcladora para lavabo",
        category: "Plomería",
        price: 89900,
        tag: "faucet",
        stock: { centro: 12, norte: 4 },
      },
      {
        key: "destapacanos",
        name: "Destapacaños manual",
        category: "Plomería",
        price: 21900,
        tag: "plunger",
        stock: { centro: 25, norte: 18 },
      },
      {
        key: "teflon",
        name: 'Cinta teflón 3/4" (paquete 5)',
        category: "Plomería",
        price: 7900,
        tag: "tape",
        stock: { centro: 3 },
      },
      {
        key: "flotador",
        name: "Kit flotador para WC",
        category: "Plomería",
        price: 18900,
        tag: "toilet",
        stock: { norte: 0 },
      },
    ],
    workers: [
      {
        key: "luis",
        fullName: "Luis Hernández",
        specialty: "Plomería residencial",
        branch: "centro",
        login: true,
      },
      {
        key: "mario",
        fullName: "Mario Ochoa",
        specialty: "Calentadores",
        branch: "norte",
        availability: WorkerAvailability.ON_SERVICE,
      },
    ],
  },
  {
    key: "electrohogar",
    name: "ElectroHogar Chihuahua",
    owner: "Daniela Ruiz",
    type: BusinessType.MIXED,
    plan: "enterprise",
    rating: [4.6, 52],
    branches: [
      {
        key: "periferico",
        name: "Periférico de la Juventud",
        address: "Perif. de la Juventud 3302, Campestre",
        lat: 28.6413,
        lng: -106.1271,
      },
      {
        key: "sur",
        name: "Sucursal Sur",
        address: "Av. Zarco 2810, Zarco",
        lat: 28.6091,
        lng: -106.0805,
        pickup: false,
      },
      {
        key: "aeropuerto",
        name: "Bodega Aeropuerto",
        address: "Blvd. Juan Pablo II 7600",
        lat: 28.6992,
        lng: -105.9771,
        delivery: false,
        paused: true,
      },
    ],
    services: [
      {
        key: "contacto",
        name: "Instalación de contactos",
        category: "Eléctrico",
        price: 45000,
        minutes: 45,
      },
      {
        key: "corto",
        name: "Diagnóstico de cortocircuito",
        category: "Eléctrico",
        price: 70000,
        minutes: 60,
        maxMinutes: 180,
      },
      {
        key: "lamparas",
        name: "Instalación de lámparas",
        category: "Eléctrico",
        price: 55000,
        minutes: 60,
      },
      {
        key: "centro-carga",
        name: "Cambio de centro de carga",
        category: "Eléctrico",
        price: 250000,
        minutes: 240,
        paused: true,
      },
    ],
    products: [
      {
        key: "foco",
        name: "Foco LED 12W luz cálida (4 pzas)",
        category: "Eléctrico",
        price: 14900,
        tag: "lightbulb",
        stock: { periferico: 60, sur: 40 },
      },
      {
        key: "extension",
        name: "Extensión reforzada 5 m",
        category: "Eléctrico",
        price: 24900,
        tag: "cable",
        stock: { periferico: 15, sur: 2 },
      },
      {
        key: "multimetro",
        name: "Multímetro digital",
        category: "Eléctrico",
        price: 54900,
        tag: "multimeter",
        stock: { periferico: 7 },
      },
      {
        key: "apagador",
        name: "Apagador sencillo blanco",
        category: "Eléctrico",
        price: 4500,
        tag: "switch",
        stock: { periferico: 100, sur: 80 },
      },
      {
        key: "smart-plug",
        name: "Contacto inteligente Wi-Fi",
        category: "Eléctrico",
        price: 32900,
        tag: "smartplug",
        stock: { sur: 9 },
      },
      {
        key: "borrador",
        name: "Regleta con USB (borrador)",
        category: "Eléctrico",
        price: 29900,
        tag: "powerstrip",
        stock: {},
        draft: true,
      },
    ],
    workers: [
      {
        key: "sofia",
        fullName: "Sofía Medina",
        specialty: "Electricista certificada",
        branch: "periferico",
        login: true,
      },
      {
        key: "jorge",
        fullName: "Jorge Salas",
        specialty: "Instalaciones",
        branch: "sur",
      },
      {
        key: "invitado",
        fullName: "Andrés Villa",
        specialty: "Ayudante",
        branch: "sur",
        invited: true,
      },
    ],
  },
  {
    key: "clima-total",
    name: "Clima Total",
    owner: "Fernando Aguirre",
    type: BusinessType.MIXED,
    plan: "standard",
    rating: [4.9, 21],
    branches: [
      {
        key: "campestre",
        name: "Campestre",
        address: "Av. Cantera 9405, Campestre Washington",
        lat: 28.6489,
        lng: -106.1123,
      },
    ],
    services: [
      {
        key: "mantenimiento",
        name: "Mantenimiento de minisplit",
        category: "Clima",
        price: 90000,
        minutes: 90,
      },
      {
        key: "instalacion",
        name: "Instalación de minisplit",
        category: "Clima",
        price: 250000,
        minutes: 240,
        maxMinutes: 360,
      },
      {
        key: "gas",
        name: "Carga de gas refrigerante",
        category: "Clima",
        price: 120000,
        minutes: 60,
      },
      {
        key: "cooler",
        name: "Servicio a cooler evaporativo",
        category: "Clima",
        price: 60000,
        minutes: 60,
      },
    ],
    products: [
      {
        key: "filtro",
        name: "Filtro para minisplit",
        category: "Clima",
        price: 19900,
        tag: "airfilter",
        stock: { campestre: 30 },
      },
      {
        key: "aspen",
        name: "Paja aspen para cooler",
        category: "Clima",
        price: 34900,
        tag: "cooler",
        stock: { campestre: 4 },
      },
      {
        key: "control",
        name: "Control universal para minisplit",
        category: "Clima",
        price: 27900,
        tag: "remote",
        stock: { campestre: 11 },
      },
    ],
    workers: [
      {
        key: "ramon",
        fullName: "Ramón Prieto",
        specialty: "Refrigeración",
        branch: "campestre",
        login: true,
      },
    ],
  },
  {
    key: "ferreteria-llave",
    name: "Ferretería La Llave",
    owner: "Patricia Domínguez",
    type: BusinessType.PRODUCTS,
    plan: "basic",
    rating: [4.4, 88],
    branches: [
      {
        key: "juventud",
        name: "La Llave Juventud",
        address: "Av. de la Juventud 5101, Cumbres",
        lat: 28.6624,
        lng: -106.1352,
      },
      {
        key: "pacheco",
        name: "La Llave Pacheco",
        address: "C. 25 #1902, Pacheco",
        lat: 28.6249,
        lng: -106.0742,
        delivery: false,
      },
    ],
    services: [],
    products: [
      {
        key: "taladro",
        name: 'Taladro percutor 1/2" 650 W',
        category: "Herramientas",
        price: 129900,
        tag: "drill",
        stock: { juventud: 8, pacheco: 3 },
      },
      {
        key: "desarmadores",
        name: "Juego de desarmadores (12 pzas)",
        category: "Herramientas",
        price: 34900,
        tag: "screwdriver",
        stock: { juventud: 20, pacheco: 14 },
      },
      {
        key: "martillo",
        name: "Martillo de uña 16 oz",
        category: "Herramientas",
        price: 18900,
        tag: "hammer",
        stock: { juventud: 35 },
      },
      {
        key: "cinta",
        name: "Cinta métrica 8 m",
        category: "Herramientas",
        price: 12900,
        tag: "tapemeasure",
        stock: { juventud: 2, pacheco: 1 },
      },
      {
        key: "escalera",
        name: "Escalera de tijera 5 escalones",
        category: "Herramientas",
        price: 159900,
        tag: "ladder",
        stock: { pacheco: 5 },
      },
      {
        key: "silicon",
        name: "Sellador de silicón transparente",
        category: "Plomería",
        price: 8900,
        tag: "sealant",
        stock: { juventud: 48, pacheco: 30 },
      },
      {
        key: "candado",
        name: "Candado de latón 40 mm",
        category: "Cerrajería",
        price: 15900,
        tag: "padlock",
        stock: { juventud: 0, pacheco: 0 },
      },
      {
        key: "guantes",
        name: "Guantes de trabajo (par)",
        category: "Herramientas",
        price: 6900,
        tag: "gloves",
        stock: { juventud: 120 },
      },
    ],
    workers: [],
  },
  {
    key: "limpieza-brillante",
    name: "Limpieza Brillante",
    owner: "Mónica Castillo",
    type: BusinessType.SERVICES,
    plan: "basic",
    rating: [4.7, 64],
    branches: [
      {
        key: "san-felipe",
        name: "San Felipe",
        address: "Av. Universidad 2908, San Felipe",
        lat: 28.6458,
        lng: -106.0951,
      },
    ],
    services: [
      {
        key: "profunda",
        name: "Limpieza profunda de casa",
        category: "Limpieza",
        price: 140000,
        minutes: 240,
        maxMinutes: 360,
      },
      {
        key: "salas",
        name: "Lavado de salas y colchones",
        category: "Limpieza",
        price: 75000,
        minutes: 120,
      },
      {
        key: "post-obra",
        name: "Limpieza post-obra",
        category: "Limpieza",
        price: 220000,
        minutes: 360,
      },
      {
        key: "vidrios",
        name: "Limpieza de vidrios y canceles",
        category: "Limpieza",
        price: 50000,
        minutes: 90,
      },
    ],
    products: [],
    workers: [
      {
        key: "carmen",
        fullName: "Carmen Rivas",
        specialty: "Limpieza profunda",
        branch: "san-felipe",
        login: true,
      },
      {
        key: "alma",
        fullName: "Alma Juárez",
        specialty: "Tapicería",
        branch: "san-felipe",
        availability: WorkerAvailability.OFF,
      },
    ],
  },
  {
    key: "jardines-desierto",
    name: "Jardines del Desierto",
    owner: "Héctor Lozano",
    type: BusinessType.MIXED,
    plan: "standard",
    rating: [4.5, 19],
    branches: [
      {
        key: "quintas",
        name: "Quintas del Sol",
        address: "C. Hacienda del Valle 512, Quintas del Sol",
        lat: 28.6551,
        lng: -106.1468,
      },
    ],
    services: [
      {
        key: "poda",
        name: "Poda de árboles",
        category: "Jardinería",
        price: 95000,
        minutes: 180,
      },
      {
        key: "pasto",
        name: "Corte de pasto y orillado",
        category: "Jardinería",
        price: 40000,
        minutes: 60,
      },
      {
        key: "riego",
        name: "Instalación de riego por goteo",
        category: "Jardinería",
        price: 160000,
        minutes: 240,
      },
    ],
    products: [
      {
        key: "sustrato",
        name: "Sustrato para plantas 20 L",
        category: "Jardinería",
        price: 14900,
        tag: "soil",
        stock: { quintas: 40 },
      },
      {
        key: "manguera",
        name: "Manguera reforzada 15 m",
        category: "Jardinería",
        price: 39900,
        tag: "gardenhose",
        stock: { quintas: 6 },
      },
      {
        key: "suculenta",
        name: "Suculenta en maceta de barro",
        category: "Jardinería",
        price: 9900,
        tag: "succulent",
        stock: { quintas: 25 },
      },
    ],
    workers: [
      {
        key: "beto",
        fullName: "Alberto Chávez",
        specialty: "Paisajismo",
        branch: "quintas",
      },
    ],
  },
  {
    key: "pinturas-sierra",
    name: "Pinturas y Acabados Sierra",
    owner: "Gabriela Ortega",
    type: BusinessType.MIXED,
    plan: "basic",
    rating: null,
    branches: [
      {
        key: "sierra",
        name: "Sierra Azul",
        address: "Av. Homero 1620, Complejo Industrial",
        lat: 28.6862,
        lng: -106.0981,
      },
    ],
    services: [
      {
        key: "recamara",
        name: "Pintura de recámara",
        category: "Pintura",
        price: 180000,
        minutes: 360,
      },
      {
        key: "impermeabilizacion",
        name: "Impermeabilización de azotea",
        category: "Pintura",
        price: 450000,
        minutes: 480,
        maxMinutes: 960,
      },
      {
        key: "carpinteria",
        name: "Reparación de puertas de madera",
        category: "Carpintería",
        price: 80000,
        minutes: 120,
      },
    ],
    products: [
      {
        key: "vinilica",
        name: "Pintura vinílica blanca 19 L",
        category: "Pintura",
        price: 189900,
        tag: "paint",
        stock: { sierra: 14 },
      },
      {
        key: "rodillo",
        name: "Kit rodillo y charola",
        category: "Pintura",
        price: 21900,
        tag: "paintroller",
        stock: { sierra: 22 },
      },
      {
        key: "impermeabilizante",
        name: "Impermeabilizante 5 años 19 L",
        category: "Pintura",
        price: 239900,
        tag: "roof",
        stock: { sierra: 1 },
      },
    ],
    workers: [
      {
        key: "ivan",
        fullName: "Iván Torres",
        specialty: "Pintor",
        branch: "sierra",
      },
    ],
  },
  {
    key: "cerrajeria-24",
    name: "Cerrajería 24/7",
    owner: "Eduardo Navarro",
    type: BusinessType.SERVICES,
    plan: "standard",
    rating: [4.2, 11],
    branches: [
      {
        key: "centro",
        name: "Centro",
        address: "C. Libertad 908, Centro",
        lat: 28.6377,
        lng: -106.0756,
      },
    ],
    services: [
      {
        key: "apertura",
        name: "Apertura de puerta",
        category: "Otro",
        price: 55000,
        minutes: 30,
      },
      {
        key: "chapa",
        name: "Cambio de chapa",
        category: "Otro",
        price: 70000,
        minutes: 60,
      },
      {
        key: "copia",
        name: "Duplicado de llaves a domicilio",
        category: "Otro",
        price: 25000,
        minutes: 30,
      },
    ],
    products: [],
    workers: [
      {
        key: "pepe",
        fullName: "José Ibarra",
        specialty: "Cerrajero",
        branch: "centro",
      },
    ],
  },
  {
    // Admin queue: awaiting approval, not visible in the marketplace.
    key: "fumigaciones",
    name: "Fumigaciones Seguras",
    owner: "Laura Peña",
    type: BusinessType.SERVICES,
    status: BusinessStatus.PENDING,
    plan: null,
    rating: null,
    branches: [
      {
        key: "industrial",
        name: "Nombre de Dios",
        address: "Av. Nombre de Dios 3304",
        lat: 28.6779,
        lng: -106.0663,
      },
    ],
    services: [
      {
        key: "fumigacion",
        name: "Fumigación de casa habitación",
        category: "Otro",
        price: 85000,
        minutes: 90,
      },
    ],
    products: [],
    workers: [],
  },
];

const CUSTOMERS = [
  {
    key: "ana",
    name: "Ana López",
    neighborhood: "Campestre",
    address: "C. Paseo de los Leones 2210, Campestre",
    lat: 28.6447,
    lng: -106.1189,
  },
  {
    key: "carlos",
    name: "Carlos Martínez",
    neighborhood: "San Felipe",
    address: "C. Ojinaga 3105, San Felipe",
    lat: 28.6436,
    lng: -106.0898,
  },
  {
    key: "elena",
    name: "Elena García",
    neighborhood: "Cumbres",
    address: "C. Cumbre del Sol 712, Cumbres",
    lat: 28.6667,
    lng: -106.1311,
  },
  {
    key: "miguel",
    name: "Miguel Torres",
    neighborhood: "Centro",
    address: "C. Aldama 515, Centro",
    lat: 28.6329,
    lng: -106.0751,
  },
  {
    key: "valeria",
    name: "Valeria Sánchez",
    neighborhood: "Quintas del Sol",
    address: "C. Valle Escondido 1402, Quintas del Sol",
    lat: 28.6573,
    lng: -106.1421,
  },
] as const;

type CustomerKey = (typeof CUSTOMERS)[number]["key"];

const emailFor = (local: string) => `${local}@${EMAIL_DOMAIN}`;

async function upsertUser(input: {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: { ...input, emailVerified: new Date() },
  });
}

async function seedPlans() {
  const plans = [
    {
      code: "basic",
      name: "Básico",
      priceCents: 49900,
      commissionPct: 12,
      maxBranches: 1,
      maxWorkers: 3,
      maxProducts: 50,
    },
    {
      code: "standard",
      name: "Estándar",
      priceCents: 99900,
      commissionPct: 8,
      maxBranches: 3,
      maxWorkers: 10,
      maxProducts: 500,
    },
    {
      code: "enterprise",
      name: "Empresarial",
      priceCents: 249900,
      commissionPct: 5,
      maxBranches: null,
      maxWorkers: null,
      maxProducts: null,
    },
  ];
  const byCode = new Map<string, { id: string; commissionPct: number }>();

  for (const plan of plans) {
    const row = await prisma.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
    byCode.set(plan.code, { id: row.id, commissionPct: row.commissionPct });
  }

  return byCode;
}

type SeededBusiness = {
  id: string;
  ownerId: string;
  commissionPct: number;
  branches: Map<string, string>;
  services: Map<
    string,
    { id: string; price: number; name: string; category: string }
  >;
  products: Map<string, { id: string; price: number; name: string }>;
  workers: Map<string, string>;
};

async function seedBusiness(
  seed: BusinessSeed,
  plans: Map<string, { id: string; commissionPct: number }>,
  passwordHash: string,
): Promise<SeededBusiness> {
  const owner = await upsertUser({
    email: emailFor(`negocio.${seed.key}`),
    name: seed.owner,
    role: UserRole.BUSINESS,
    passwordHash,
  });
  const businessId = `demo-biz-${seed.key}`;

  await prisma.business.upsert({
    where: { id: businessId },
    update: {},
    create: {
      id: businessId,
      name: seed.name,
      type: seed.type,
      status: seed.status ?? BusinessStatus.ACTIVE,
      guaranteeType: GuaranteeType.DEPOSIT,
      ownerId: owner.id,
      ratingAvg: seed.rating?.[0] ?? null,
      ratingCount: seed.rating?.[1] ?? 0,
    },
  });

  const plan = seed.plan ? plans.get(seed.plan) : undefined;

  if (plan) {
    await prisma.subscription.upsert({
      where: { businessId },
      update: {},
      create: {
        id: `demo-sub-${seed.key}`,
        businessId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        renewsAt: daysFromNow(21),
      },
    });
  }

  const branches = new Map<string, string>();

  for (const branch of seed.branches) {
    const id = `demo-branch-${seed.key}-${branch.key}`;
    await prisma.branch.upsert({
      where: { id },
      update: {},
      create: {
        id,
        businessId,
        name: branch.name,
        address: branch.address,
        latitude: branch.lat,
        longitude: branch.lng,
        coverageRadiusKm: 15,
        pickupEnabled: branch.pickup ?? true,
        deliveryEnabled: branch.delivery ?? true,
        status: branch.paused ? BranchStatus.PAUSED : BranchStatus.ACTIVE,
      },
    });
    branches.set(branch.key, id);
  }

  const services = new Map<
    string,
    { id: string; price: number; name: string; category: string }
  >();

  for (const service of seed.services) {
    const id = `demo-svc-${seed.key}-${service.key}`;
    await prisma.service.upsert({
      where: { id },
      update: {},
      create: {
        id,
        businessId,
        name: service.name,
        category: service.category,
        basePriceCents: service.price,
        durationMinutes: service.minutes,
        durationMaxMinutes: service.maxMinutes ?? null,
        status: service.paused ? ServiceStatus.PAUSED : ServiceStatus.ACTIVE,
      },
    });
    services.set(service.key, {
      id,
      price: service.price,
      name: service.name,
      category: service.category,
    });
  }

  const products = new Map<
    string,
    { id: string; price: number; name: string }
  >();

  for (const [index, product] of seed.products.entries()) {
    const id = `demo-prod-${seed.key}-${product.key}`;
    await prisma.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        businessId,
        name: product.name,
        sku: `${seed.key}-${product.key}`.toUpperCase().slice(0, 40),
        category: product.category,
        priceCents: product.price,
        imageUrl: image(product.tag, index + 1),
        status: product.draft ? ProductStatus.DRAFT : ProductStatus.PUBLISHED,
      },
    });

    for (const [branchKey, stock] of Object.entries(product.stock)) {
      const branchId = branches.get(branchKey);
      if (!branchId) continue;

      await prisma.productStock.upsert({
        where: { productId_branchId: { productId: id, branchId } },
        update: {},
        create: { productId: id, branchId, stock, lowStockThreshold: 5 },
      });
    }

    products.set(product.key, { id, price: product.price, name: product.name });
  }

  const workers = new Map<string, string>();

  for (const worker of seed.workers) {
    const id = `demo-worker-${seed.key}-${worker.key}`;
    const user = worker.login
      ? await upsertUser({
          email: emailFor(`tecnico.${worker.key}`),
          name: worker.fullName,
          role: UserRole.WORKER,
          passwordHash,
        })
      : null;

    await prisma.worker.upsert({
      where: { id },
      update: {},
      create: {
        id,
        businessId,
        userId: user?.id ?? null,
        fullName: worker.fullName,
        specialty: worker.specialty,
        branchId: branches.get(worker.branch) ?? null,
        availability: worker.availability ?? WorkerAvailability.AVAILABLE,
        ratingAvg: worker.invited ? null : 4.7,
        invitationStatus: worker.invited
          ? InvitationStatus.PENDING
          : InvitationStatus.ACCEPTED,
        invitedEmail: worker.invited
          ? emailFor(`invitado.${worker.key}`)
          : null,
        invitationExpiresAt: worker.invited ? daysFromNow(5) : null,
      },
    });
    workers.set(worker.key, id);
  }

  return {
    id: businessId,
    ownerId: owner.id,
    commissionPct: plan?.commissionPct ?? 0,
    branches,
    services,
    products,
    workers,
  };
}

function need<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Demo seed: missing ${label}`);
  return value;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const plans = await seedPlans();
  const biz = new Map<string, SeededBusiness>();

  for (const seed of BUSINESSES) {
    biz.set(seed.key, await seedBusiness(seed, plans, passwordHash));
  }

  const customers = new Map<
    CustomerKey,
    { id: string; address: (typeof CUSTOMERS)[number] }
  >();

  for (const customer of CUSTOMERS) {
    const user = await upsertUser({
      email: emailFor(`cliente.${customer.key}`),
      name: customer.name,
      role: UserRole.CUSTOMER,
      passwordHash,
    });
    await prisma.address.upsert({
      where: { id: `demo-addr-${customer.key}-casa` },
      update: {},
      create: {
        id: `demo-addr-${customer.key}-casa`,
        userId: user.id,
        label: "Casa",
        addressLine: customer.address,
        neighborhood: customer.neighborhood,
        latitude: customer.lat,
        longitude: customer.lng,
        isDefault: true,
      },
    });
    customers.set(customer.key, { id: user.id, address: customer });
  }

  // A second address for one customer (address picker / default switch).
  const ana = need(customers.get("ana"), "customer ana");
  await prisma.address.upsert({
    where: { id: "demo-addr-ana-oficina" },
    update: {},
    create: {
      id: "demo-addr-ana-oficina",
      userId: ana.id,
      label: "Oficina",
      addressLine: "Av. Teófilo Borunda 8670, Parque Industrial",
      neighborhood: "Parque Industrial",
      latitude: 28.6702,
      longitude: -106.1046,
    },
  });

  // ---- Service requests with quotes -------------------------------------
  type QuoteSeed = {
    biz: string;
    amount: number;
    worker?: string;
    message: string;
    status?: QuoteStatus;
    days?: number;
  };
  type RequestSeed = {
    key: string;
    customer: CustomerKey;
    title: string;
    category: string;
    diagnosis: string;
    confidence: number;
    min: number;
    max: number;
    urgency: AiUrgency;
    status: RequestStatus;
    daysAgo: number;
    suggestedService?: [string, string];
    suggestedProduct?: [string, string];
    target?: string;
    quotes: QuoteSeed[];
  };

  const REQUESTS: RequestSeed[] = [
    {
      key: "fuga-cocina",
      customer: "ana",
      title: "Fuga debajo del fregadero de la cocina",
      category: "Plomería",
      diagnosis:
        "Se observa goteo constante en la conexión del sifón y humedad en el mueble. Probablemente el empaque está desgastado; conviene cambiar sifón y empaques.",
      confidence: 86,
      min: 55000,
      max: 90000,
      urgency: AiUrgency.MEDIUM,
      status: RequestStatus.QUOTED,
      daysAgo: 1,
      suggestedService: ["plomeria-norte", "fuga"],
      suggestedProduct: ["plomeria-norte", "destapacanos"],
      quotes: [
        {
          biz: "plomeria-norte",
          amount: 65000,
          worker: "luis",
          message: "Puedo ir hoy en la tarde, incluye empaques.",
          days: 1,
        },
        {
          biz: "ferreteria-llave",
          amount: 0,
          message: "",
          status: QuoteStatus.WITHDRAWN,
        },
      ],
    },
    {
      key: "minisplit",
      customer: "ana",
      title: "El minisplit no enfría y gotea agua",
      category: "Clima",
      diagnosis:
        "El equipo muestra escarcha en la unidad interior y goteo. Puede ser filtro sucio o falta de gas refrigerante. Se recomienda mantenimiento y revisión de presión.",
      confidence: 74,
      min: 90000,
      max: 180000,
      urgency: AiUrgency.HIGH,
      status: RequestStatus.QUOTED,
      daysAgo: 0,
      suggestedService: ["clima-total", "mantenimiento"],
      suggestedProduct: ["clima-total", "filtro"],
      quotes: [
        {
          biz: "clima-total",
          amount: 95000,
          worker: "ramon",
          message: "Mantenimiento completo + revisión de gas. Mañana 10:00.",
          days: 1,
        },
        {
          biz: "electrohogar",
          amount: 120000,
          worker: "sofia",
          message: "Revisamos la parte eléctrica y la tarjeta.",
          days: 2,
        },
      ],
    },
    {
      key: "contactos",
      customer: "carlos",
      title: "Contactos sin corriente en la sala",
      category: "Eléctrico",
      diagnosis:
        "Varios contactos de la misma línea sin energía; posible pastilla botada o conexión floja en una caja intermedia.",
      confidence: 68,
      min: 45000,
      max: 90000,
      urgency: AiUrgency.MEDIUM,
      status: RequestStatus.OPEN,
      daysAgo: 0,
      suggestedService: ["electrohogar", "corto"],
      quotes: [],
    },
    {
      key: "pasto",
      customer: "valeria",
      title: "Pasto crecido y árboles sin podar",
      category: "Jardinería",
      diagnosis:
        "Jardín de ~60 m² con pasto alto y dos árboles con ramas sobre la barda. Requiere corte, orillado y poda ligera.",
      confidence: 91,
      min: 80000,
      max: 140000,
      urgency: AiUrgency.LOW,
      status: RequestStatus.OPEN,
      daysAgo: 2,
      target: "jardines-desierto",
      quotes: [],
    },
    {
      key: "limpieza",
      customer: "elena",
      title: "Limpieza profunda antes de mudanza",
      category: "Limpieza",
      diagnosis:
        "Casa de dos plantas con polvo acumulado y cocina con grasa. Se recomienda limpieza profunda con desengrasante.",
      confidence: 88,
      min: 120000,
      max: 180000,
      urgency: AiUrgency.LOW,
      status: RequestStatus.ACCEPTED,
      daysAgo: 6,
      suggestedService: ["limpieza-brillante", "profunda"],
      quotes: [
        {
          biz: "limpieza-brillante",
          amount: 145000,
          worker: "carmen",
          message: "Dos personas, 5 horas aprox.",
          status: QuoteStatus.ACCEPTED,
          days: -3,
        },
      ],
    },
    {
      key: "pintura",
      customer: "miguel",
      title: "Manchas de humedad en el techo de la recámara",
      category: "Pintura",
      diagnosis:
        "Manchas por filtración desde la azotea. Primero impermeabilizar y después resanar y pintar.",
      confidence: 79,
      min: 200000,
      max: 450000,
      urgency: AiUrgency.MEDIUM,
      status: RequestStatus.ACCEPTED,
      daysAgo: 12,
      suggestedService: ["pinturas-sierra", "impermeabilizacion"],
      suggestedProduct: ["pinturas-sierra", "impermeabilizante"],
      quotes: [
        {
          biz: "pinturas-sierra",
          amount: 420000,
          worker: "ivan",
          message: "Incluye material para 40 m².",
          status: QuoteStatus.ACCEPTED,
          days: -9,
        },
        {
          biz: "limpieza-brillante",
          amount: 0,
          message: "",
          status: QuoteStatus.REJECTED,
        },
      ],
    },
    {
      key: "chapa",
      customer: "carlos",
      title: "La chapa de la puerta principal está trabada",
      category: "Otro",
      diagnosis:
        "La chapa no gira completamente; el mecanismo interno parece dañado. Recomendable cambio de chapa.",
      confidence: 82,
      min: 50000,
      max: 90000,
      urgency: AiUrgency.HIGH,
      status: RequestStatus.CANCELLED,
      daysAgo: 9,
      suggestedService: ["cerrajeria-24", "chapa"],
      quotes: [
        {
          biz: "cerrajeria-24",
          amount: 70000,
          message: "Llego en 40 min.",
          status: QuoteStatus.EXPIRED,
        },
      ],
    },
    {
      key: "boiler",
      customer: "elena",
      title: "El boiler no calienta el agua",
      category: "Plomería",
      diagnosis:
        "El piloto se apaga constantemente; puede ser termopar dañado.",
      confidence: 64,
      min: 60000,
      max: 150000,
      urgency: AiUrgency.MEDIUM,
      status: RequestStatus.EXPIRED,
      daysAgo: 20,
      quotes: [],
    },
  ];

  const ensureQuoteAmount = (quote: QuoteSeed) =>
    quote.amount > 0 ? quote.amount : 60000;

  for (const request of REQUESTS) {
    const customer = need(customers.get(request.customer), request.customer);
    const id = `demo-req-${request.key}`;
    const suggestedServiceId = request.suggestedService
      ? (biz
          .get(request.suggestedService[0])
          ?.services.get(request.suggestedService[1])?.id ?? null)
      : null;
    const suggestedProductId = request.suggestedProduct
      ? (biz
          .get(request.suggestedProduct[0])
          ?.products.get(request.suggestedProduct[1])?.id ?? null)
      : null;

    await prisma.serviceRequest.upsert({
      where: { id },
      update: {},
      create: {
        id,
        customerId: customer.id,
        title: request.title,
        description: request.title,
        category: request.category,
        photoUrls: [],
        aiConfidencePct: request.confidence,
        aiDiagnosis: request.diagnosis,
        aiMinPriceCents: request.min,
        aiMaxPriceCents: request.max,
        aiUrgency: request.urgency,
        addressLine: customer.address.address,
        neighborhood: customer.address.neighborhood,
        latitude: customer.address.lat,
        longitude: customer.address.lng,
        status: request.status,
        expiresAt:
          request.status === RequestStatus.EXPIRED
            ? daysAgo(request.daysAgo - 2)
            : daysFromNow(3),
        suggestedServiceId,
        suggestedProductId,
        targetBusinessId: request.target
          ? (biz.get(request.target)?.id ?? null)
          : null,
        createdAt: daysAgo(request.daysAgo),
      },
    });

    for (const quote of request.quotes) {
      const business = need(biz.get(quote.biz), quote.biz);
      await prisma.quote.upsert({
        where: { id: `demo-quote-${request.key}-${quote.biz}` },
        update: {},
        create: {
          id: `demo-quote-${request.key}-${quote.biz}`,
          requestId: id,
          businessId: business.id,
          branchId: [...business.branches.values()][0] ?? null,
          workerId: quote.worker
            ? (business.workers.get(quote.worker) ?? null)
            : null,
          amountCents: ensureQuoteAmount(quote),
          message: quote.message || null,
          scheduledFor:
            quote.days !== undefined ? daysFromNow(quote.days) : null,
          status: quote.status ?? QuoteStatus.PENDING,
          createdAt: daysAgo(Math.max(request.daysAgo - 0.5, 0)),
        },
      });
    }
  }

  // ---- Orders across the lifecycle --------------------------------------
  type OrderSeed = {
    key: string;
    customer: CustomerKey;
    biz: string;
    type: OrderType;
    status: OrderStatus;
    daysAgo: number;
    service?: string;
    product?: string;
    quantity?: number;
    quote?: string;
    worker?: string;
    method?: FulfillmentMethod;
    events: OrderEventType[];
    review?: [number, string];
    chat?: string[];
    /** The chat opens with the customer instead of the business. */
    customerFirst?: boolean;
  };

  const ORDERS: OrderSeed[] = [
    // Services
    {
      key: "limpieza",
      customer: "elena",
      biz: "limpieza-brillante",
      type: OrderType.SERVICE,
      status: OrderStatus.PAID,
      daysAgo: 3,
      service: "profunda",
      quote: "demo-quote-limpieza-limpieza-brillante",
      worker: "carmen",
      events: [OrderEventType.ACCEPTED, OrderEventType.ESCROW_HELD],
      chat: [
        "¡Hola! Confirmo la visita para el jueves a las 9:00.",
        "Perfecto, ahí los espero.",
        "¿Tienen escalera? Hay que limpiar candiles.",
      ],
    },
    {
      key: "pintura",
      customer: "miguel",
      biz: "pinturas-sierra",
      type: OrderType.SERVICE,
      status: OrderStatus.IN_PROGRESS,
      daysAgo: 9,
      service: "impermeabilizacion",
      quote: "demo-quote-pintura-pinturas-sierra",
      worker: "ivan",
      events: [
        OrderEventType.ACCEPTED,
        OrderEventType.ESCROW_HELD,
        OrderEventType.EN_ROUTE,
        OrderEventType.ARRIVED,
        OrderEventType.RECORDING_STARTED,
      ],
      chat: [
        "Ya vamos en camino, llegamos en 20 min.",
        "Gracias, la puerta está abierta.",
      ],
    },
    {
      key: "fuga-ok",
      customer: "ana",
      biz: "plomeria-norte",
      type: OrderType.SERVICE,
      status: OrderStatus.COMPLETED,
      daysAgo: 25,
      service: "fuga",
      worker: "luis",
      events: [
        OrderEventType.ACCEPTED,
        OrderEventType.ESCROW_HELD,
        OrderEventType.EN_ROUTE,
        OrderEventType.ARRIVED,
        OrderEventType.WORK_DONE,
        OrderEventType.CONFIRMED,
      ],
      review: [
        5,
        "Llegaron puntuales y dejaron todo limpio. Muy recomendables.",
      ],
    },
    {
      key: "minisplit-ok",
      customer: "carlos",
      biz: "clima-total",
      type: OrderType.SERVICE,
      status: OrderStatus.COMPLETED,
      daysAgo: 40,
      service: "mantenimiento",
      worker: "ramon",
      events: [
        OrderEventType.ACCEPTED,
        OrderEventType.ESCROW_HELD,
        OrderEventType.WORK_DONE,
        OrderEventType.CONFIRMED,
      ],
      review: [4, "Buen servicio, aunque llegaron un poco tarde."],
    },
    {
      key: "contactos-ok",
      customer: "valeria",
      biz: "electrohogar",
      type: OrderType.SERVICE,
      status: OrderStatus.COMPLETED,
      daysAgo: 15,
      service: "contacto",
      worker: "sofia",
      events: [
        OrderEventType.ACCEPTED,
        OrderEventType.ESCROW_HELD,
        OrderEventType.WORK_DONE,
        OrderEventType.AUTO_RELEASED,
      ],
    },
    {
      key: "poda-cancelada",
      customer: "valeria",
      biz: "jardines-desierto",
      type: OrderType.SERVICE,
      status: OrderStatus.CANCELLED,
      daysAgo: 18,
      service: "poda",
      events: [OrderEventType.ACCEPTED],
    },
    {
      key: "apertura-pend",
      customer: "miguel",
      biz: "cerrajeria-24",
      type: OrderType.SERVICE,
      status: OrderStatus.PENDING,
      daysAgo: 0,
      service: "apertura",
      events: [],
    },
    // Products
    {
      key: "taladro-envio",
      customer: "elena",
      biz: "ferreteria-llave",
      type: OrderType.PRODUCT,
      status: OrderStatus.SHIPPING,
      daysAgo: 1,
      product: "taladro",
      method: FulfillmentMethod.DELIVERY,
      events: [OrderEventType.ESCROW_HELD],
      customerFirst: true,
      chat: [
        "¿A qué hora llega el repartidor?",
        "Entre 4 y 6 pm, le avisamos al salir.",
      ],
    },
    {
      key: "focos-pagado",
      customer: "ana",
      biz: "electrohogar",
      type: OrderType.PRODUCT,
      status: OrderStatus.PAID,
      daysAgo: 0,
      product: "foco",
      quantity: 3,
      method: FulfillmentMethod.DELIVERY,
      events: [OrderEventType.ESCROW_HELD],
    },
    {
      key: "filtro-recogido",
      customer: "carlos",
      biz: "clima-total",
      type: OrderType.PRODUCT,
      status: OrderStatus.COMPLETED,
      daysAgo: 30,
      product: "filtro",
      quantity: 2,
      method: FulfillmentMethod.PICKUP,
      events: [OrderEventType.ESCROW_HELD, OrderEventType.CONFIRMED],
      review: [5, "Listo en 10 minutos en sucursal."],
    },
    {
      key: "pintura-entregada",
      customer: "miguel",
      biz: "pinturas-sierra",
      type: OrderType.PRODUCT,
      status: OrderStatus.COMPLETED,
      daysAgo: 22,
      product: "vinilica",
      method: FulfillmentMethod.DELIVERY,
      events: [OrderEventType.ESCROW_HELD, OrderEventType.CONFIRMED],
      review: [4, "Buena pintura, llegó al día siguiente."],
    },
    {
      key: "manguera-envio",
      customer: "valeria",
      biz: "jardines-desierto",
      type: OrderType.PRODUCT,
      status: OrderStatus.SHIPPING,
      daysAgo: 2,
      product: "manguera",
      method: FulfillmentMethod.DELIVERY,
      events: [OrderEventType.ESCROW_HELD],
    },
    {
      key: "desarmadores-ok",
      customer: "ana",
      biz: "ferreteria-llave",
      type: OrderType.PRODUCT,
      status: OrderStatus.COMPLETED,
      daysAgo: 45,
      product: "desarmadores",
      method: FulfillmentMethod.PICKUP,
      events: [OrderEventType.ESCROW_HELD, OrderEventType.CONFIRMED],
      review: [3, "El producto bien, la atención en mostrador lenta."],
    },
  ];

  for (const order of ORDERS) {
    const customer = need(customers.get(order.customer), order.customer);
    const business = need(biz.get(order.biz), order.biz);
    const service = order.service
      ? need(business.services.get(order.service), order.service)
      : null;
    const product = order.product
      ? need(business.products.get(order.product), order.product)
      : null;
    const quantity = order.quantity ?? 1;
    const quote = order.quote
      ? await prisma.quote.findUnique({
          where: { id: order.quote },
          select: { id: true, amountCents: true },
        })
      : null;
    const providerAmount =
      quote?.amountCents ??
      (product ? product.price * quantity : (service?.price ?? 0));
    const id = `demo-order-${order.key}`;
    const createdAt = daysAgo(order.daysAgo);
    const branchId = [...business.branches.values()][0] ?? null;
    const delivery = order.method === FulfillmentMethod.DELIVERY;

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id,
          type: order.type,
          title:
            service?.name ??
            `${product?.name ?? "Producto"}${quantity > 1 ? ` ×${quantity}` : ""}`,
          status: order.status,
          amountCents: providerAmount,
          customerId: customer.id,
          businessId: business.id,
          branchId,
          serviceId: service?.id ?? null,
          productId: product?.id ?? null,
          quoteId: quote?.id ?? null,
          workerId: order.worker
            ? (business.workers.get(order.worker) ?? null)
            : null,
          quantity,
          fulfillmentMethod: order.method ?? null,
          deliveryAddressLine:
            delivery || order.type === OrderType.SERVICE
              ? customer.address.address
              : null,
          deliveryLatitude:
            delivery || order.type === OrderType.SERVICE
              ? customer.address.lat
              : null,
          deliveryLongitude:
            delivery || order.type === OrderType.SERVICE
              ? customer.address.lng
              : null,
          pickedUpAt:
            order.method === FulfillmentMethod.PICKUP &&
            order.status === OrderStatus.COMPLETED
              ? new Date(createdAt.getTime() + DAY / 2)
              : null,
          recordingComplete:
            order.status === OrderStatus.COMPLETED &&
            order.type === OrderType.SERVICE,
          recordingDurationSec:
            order.status === OrderStatus.COMPLETED &&
            order.type === OrderType.SERVICE
              ? 2700
              : null,
          workNotes:
            order.status === OrderStatus.COMPLETED &&
            order.type === OrderType.SERVICE
              ? "Trabajo terminado y probado con el cliente."
              : null,
          createdAt,
        },
      });

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CANCELLED
      ) {
        const commissionCents = Math.round(
          (providerAmount * business.commissionPct) / 100,
        );
        const released = order.status === OrderStatus.COMPLETED;

        await tx.payment.create({
          data: {
            id: `demo-pay-${order.key}`,
            orderId: id,
            businessId: business.id,
            method: PaymentMethod.CARD,
            status: released ? PaymentStatus.RELEASED : PaymentStatus.IN_ESCROW,
            amountCents: providerAmount + SERVICE_FEE_CENTS,
            providerAmountCents: providerAmount,
            serviceFeeCentsApplied: SERVICE_FEE_CENTS,
            commissionPctApplied: business.commissionPct,
            commissionCents,
            providerPlanCommissionPctApplied: business.commissionPct,
            providerPlanCommissionCents: commissionCents,
            commissionSource: CommissionSource.PROVIDER_PLAN,
            // No escrowReleaseAt: the release cron must never pick demo rows.
            releasedAt: released
              ? new Date(createdAt.getTime() + 2 * DAY)
              : null,
            createdAt,
          },
        });
      }

      for (const [index, type] of order.events.entries()) {
        await tx.orderEvent.create({
          data: {
            orderId: id,
            type,
            actorUserId:
              type === OrderEventType.CONFIRMED
                ? customer.id
                : business.ownerId,
            createdAt: new Date(
              createdAt.getTime() + (index + 1) * 60 * 60 * 1000,
            ),
          },
        });
      }

      if (order.review) {
        await tx.review.create({
          data: {
            orderId: id,
            customerId: customer.id,
            rating: order.review[0],
            comment: order.review[1],
            createdAt: new Date(createdAt.getTime() + 3 * DAY),
          },
        });
      }

      if (order.chat) {
        const conversation = await tx.conversation.create({
          data: { id: `demo-conv-${order.key}`, orderId: id },
        });

        for (const [index, body] of order.chat.entries()) {
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              // Alternate business ↔ customer (business first by default).
              senderId:
                (index % 2 === 0) !== (order.customerFirst ?? false)
                  ? business.ownerId
                  : customer.id,
              type: MessageType.TEXT,
              body,
              readAt: index < order.chat.length - 1 ? new Date() : null,
              createdAt: new Date(
                createdAt.getTime() + (index + 1) * 10 * 60 * 1000,
              ),
            },
          });
        }
      }
    });
  }

  // Pre-sale inquiry about a product (chat without order).
  const elena = need(customers.get("elena"), "elena");
  const llave = need(biz.get("ferreteria-llave"), "ferreteria-llave");
  const inquiryId = "demo-conv-inquiry-taladro";
  if (!(await prisma.conversation.findUnique({ where: { id: inquiryId } }))) {
    await prisma.conversation.create({
      data: {
        id: inquiryId,
        businessId: llave.id,
        customerId: elena.id,
        productId: llave.products.get("escalera")?.id ?? null,
        messages: {
          create: [
            {
              senderId: elena.id,
              type: MessageType.TEXT,
              body: "¿La escalera aguanta 150 kg?",
              createdAt: daysAgo(0.2),
            },
            {
              senderId: llave.ownerId,
              type: MessageType.TEXT,
              body: "Sí, soporta hasta 150 kg (tipo II).",
              createdAt: daysAgo(0.1),
            },
          ],
        },
      },
    });
  }

  console.log(
    `Demo seed listo. Contraseña de todas las cuentas: ${DEMO_PASSWORD}`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error("Demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
