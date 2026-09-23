import {
  type BusinessType,
  BusinessStatus,
  type DisputeStatus,
  DisputeStatus as DisputeStatusEnum,
  type DocumentStatus,
  DocumentStatus as DocumentStatusEnum,
  type DocumentType,
  type GuaranteeType,
  type OrderStatus,
  type Prisma,
  type PrismaClient,
  type SubscriptionStatus,
  UserRole,
  type WorkerAvailability,
} from "@generated/prisma";

import {
  USERS_PAGE_SIZE,
  type BusinessDerivedStatus,
  type ListUsersInput,
  type UserAccessStatus,
  type UsersFiltersInput,
} from "~/app/[locale]/admin/users/_components/users.schema";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

type DirectoryDb = Pick<PrismaClient, "business" | "user" | "worker">;

export interface UserCounts {
  businesses: number;
  customers: number;
  workers: number;
}

export interface BusinessRow {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  derivedStatus: BusinessDerivedStatus;
  guaranteeType: GuaranteeType;
  ownerName: string | null;
  ownerEmail: string | null;
  ordersCount: number;
  openDisputesCount: number;
  /** Oldest unresolved dispute, the one "view dispute" jumps to. */
  firstOpenDisputeId: string | null;
  pendingDocumentsCount: number;
  createdAt: Date;
}

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  accessStatus: UserAccessStatus;
  ordersCount: number;
  createdAt: Date;
}

export interface WorkerRow {
  id: string;
  fullName: string;
  businessId: string;
  businessName: string;
  /** Null while the worker never claimed an app account. */
  userId: string | null;
  accessStatus: UserAccessStatus | null;
  branchName: string | null;
  specialty: string | null;
  availability: WorkerAvailability;
  createdAt: Date;
}

export type ListUsersResult =
  | {
      tab: "businesses";
      counts: UserCounts;
      nextCursor: string | null;
      items: BusinessRow[];
    }
  | {
      tab: "customers";
      counts: UserCounts;
      nextCursor: string | null;
      items: CustomerRow[];
    }
  | {
      tab: "workers";
      counts: UserCounts;
      nextCursor: string | null;
      items: WorkerRow[];
    };

export interface BusinessDetail {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  statusReason: string | null;
  derivedStatus: BusinessDerivedStatus;
  guaranteeType: GuaranteeType;
  guaranteeNotes: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: Date;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  subscription: {
    planCode: string;
    status: SubscriptionStatus;
    renewsAt: Date;
  } | null;
  ordersCount: number;
  recentOrders: Array<{
    id: string;
    folio: number;
    title: string;
    amountCents: number;
    status: OrderStatus;
    createdAt: Date;
  }>;
  disputes: {
    openCount: number;
    items: Array<{
      id: string;
      title: string;
      status: DisputeStatus;
      urgency: "NORMAL" | "URGENT";
      createdAt: Date;
    }>;
  };
  documents: Array<{
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    fileUrl: string;
    reviewedAt: Date | null;
    reviewedByName: string | null;
    notes: string | null;
    createdAt: Date;
  }>;
}

const UNRESOLVED_DISPUTE_FILTER = {
  status: { not: DisputeStatusEnum.RESOLVED },
} satisfies Prisma.DisputeWhereInput;

const businessListSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  guaranteeType: true,
  createdAt: true,
  owner: { select: { name: true, email: true } },
  disputes: {
    where: UNRESOLVED_DISPUTE_FILTER,
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { id: true },
  },
  _count: {
    select: {
      orders: true,
      disputes: { where: UNRESOLVED_DISPUTE_FILTER },
      documents: { where: { status: DocumentStatusEnum.PENDING } },
    },
  },
} satisfies Prisma.BusinessSelect;

const customerListSelect = {
  id: true,
  name: true,
  email: true,
  suspendedAt: true,
  createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.UserSelect;

const workerListSelect = {
  id: true,
  fullName: true,
  specialty: true,
  availability: true,
  createdAt: true,
  userId: true,
  user: { select: { suspendedAt: true } },
  business: { select: { id: true, name: true } },
  branch: { select: { name: true } },
} satisfies Prisma.WorkerSelect;

/**
 * Badge precedence: a non-ACTIVE status always wins; only an ACTIVE business
 * with an unresolved dispute is shown as "in dispute".
 */
function toDerivedStatus(
  status: BusinessStatus,
  openDisputes: number,
): BusinessDerivedStatus {
  switch (status) {
    case BusinessStatus.PENDING:
      return "pending";
    case BusinessStatus.SUSPENDED:
      return "suspended";
    case BusinessStatus.REJECTED:
      return "rejected";
    case BusinessStatus.ACTIVE:
      return openDisputes > 0 ? "in_dispute" : "active";
  }
}

function derivedStatusFilter(
  status: BusinessDerivedStatus | undefined,
): Prisma.BusinessWhereInput {
  switch (status) {
    case undefined:
      return {};
    case "active":
      return {
        status: BusinessStatus.ACTIVE,
        disputes: { none: UNRESOLVED_DISPUTE_FILTER },
      };
    case "in_dispute":
      return {
        status: BusinessStatus.ACTIVE,
        disputes: { some: UNRESOLVED_DISPUTE_FILTER },
      };
    case "pending":
      return { status: BusinessStatus.PENDING };
    case "suspended":
      return { status: BusinessStatus.SUSPENDED };
    case "rejected":
      return { status: BusinessStatus.REJECTED };
  }
}

function businessSearchFilter(search: string): Prisma.BusinessWhereInput {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { owner: { name: { contains: search, mode: "insensitive" } } },
      { owner: { email: { contains: search, mode: "insensitive" } } },
    ],
  };
}

function customerSearchFilter(search: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  };
}

function workerSearchFilter(search: string): Prisma.WorkerWhereInput {
  return {
    OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { business: { name: { contains: search, mode: "insensitive" } } },
    ],
  };
}

function accessStatusFilter(
  status: UserAccessStatus | undefined,
): Prisma.UserWhereInput {
  switch (status) {
    case undefined:
      return {};
    case "active":
      return { suspendedAt: null };
    case "suspended":
      return { suspendedAt: { not: null } };
  }
}

export function buildBusinessWhere(
  input: Pick<ListUsersInput, "search" | "status">,
): Prisma.BusinessWhereInput {
  return {
    ...derivedStatusFilter(input.status),
    ...(input.search ? businessSearchFilter(input.search) : {}),
  };
}

export function buildCustomerWhere(
  input: Pick<ListUsersInput, "search" | "accessStatus">,
): Prisma.UserWhereInput {
  return {
    role: UserRole.CUSTOMER,
    ...accessStatusFilter(input.accessStatus),
    ...(input.search ? customerSearchFilter(input.search) : {}),
  };
}

export function buildWorkerWhere(
  input: Pick<ListUsersInput, "search" | "availability">,
): Prisma.WorkerWhereInput {
  return {
    ...(input.availability ? { availability: input.availability } : {}),
    ...(input.search ? workerSearchFilter(input.search) : {}),
  };
}

async function getCounts(db: DirectoryDb): Promise<UserCounts> {
  const [businesses, customers, workers] = await Promise.all([
    db.business.count(),
    db.user.count({ where: { role: UserRole.CUSTOMER } }),
    db.worker.count(),
  ]);

  return { businesses, customers, workers };
}

function paginate<TRow extends { id: string }>(
  rows: TRow[],
  pageSize: number,
): { items: TRow[]; nextCursor: string | null } {
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor: hasNextPage && lastItem ? lastItem.id : null,
  };
}

export function toBusinessRow(
  row: Prisma.BusinessGetPayload<{ select: typeof businessListSelect }>,
): BusinessRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    derivedStatus: toDerivedStatus(row.status, row._count.disputes),
    guaranteeType: row.guaranteeType,
    ownerName: row.owner.name,
    ownerEmail: row.owner.email,
    ordersCount: row._count.orders,
    openDisputesCount: row._count.disputes,
    firstOpenDisputeId: row.disputes[0]?.id ?? null,
    pendingDocumentsCount: row._count.documents,
    createdAt: row.createdAt,
  };
}

export function toCustomerRow(
  row: Prisma.UserGetPayload<{ select: typeof customerListSelect }>,
): CustomerRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accessStatus: row.suspendedAt === null ? "active" : "suspended",
    ordersCount: row._count.orders,
    createdAt: row.createdAt,
  };
}

export function toWorkerRow(
  row: Prisma.WorkerGetPayload<{ select: typeof workerListSelect }>,
): WorkerRow {
  return {
    id: row.id,
    fullName: row.fullName,
    businessId: row.business.id,
    businessName: row.business.name,
    userId: row.userId,
    accessStatus: row.user
      ? row.user.suspendedAt === null
        ? "active"
        : "suspended"
      : null,
    branchName: row.branch?.name ?? null,
    specialty: row.specialty,
    availability: row.availability,
    createdAt: row.createdAt,
  };
}

const listOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export async function listUsers(
  deps: { db: DirectoryDb },
  input: ListUsersInput,
): Promise<ServiceResult<ListUsersResult>> {
  const counts = await getCounts(deps.db);
  const take = USERS_PAGE_SIZE + 1;

  if (input.tab === "businesses") {
    const rows = await deps.db.business.findMany({
      where: buildBusinessWhere(input),
      take,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: listOrderBy,
      select: businessListSelect,
    });
    const page = paginate(rows, USERS_PAGE_SIZE);

    return svcOk({
      tab: "businesses",
      counts,
      nextCursor: page.nextCursor,
      items: page.items.map(toBusinessRow),
    });
  }

  if (input.tab === "customers") {
    const rows = await deps.db.user.findMany({
      where: buildCustomerWhere(input),
      take,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: listOrderBy,
      select: customerListSelect,
    });
    const page = paginate(rows, USERS_PAGE_SIZE);

    return svcOk({
      tab: "customers",
      counts,
      nextCursor: page.nextCursor,
      items: page.items.map(toCustomerRow),
    });
  }

  const rows = await deps.db.worker.findMany({
    where: buildWorkerWhere(input),
    take,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: listOrderBy,
    select: workerListSelect,
  });
  const page = paginate(rows, USERS_PAGE_SIZE);

  return svcOk({
    tab: "workers",
    counts,
    nextCursor: page.nextCursor,
    items: page.items.map(toWorkerRow),
  });
}

export async function getBusinessDetail(
  deps: { db: DirectoryDb },
  input: { businessId: string },
): Promise<ServiceResult<BusinessDetail>> {
  const business = await deps.db.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      statusReason: true,
      guaranteeType: true,
      guaranteeNotes: true,
      createdAt: true,
      stripeAccountId: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      owner: { select: { name: true, email: true } },
      subscription: {
        select: {
          status: true,
          renewsAt: true,
          plan: { select: { code: true } },
        },
      },
      _count: {
        select: {
          orders: true,
          disputes: { where: UNRESOLVED_DISPUTE_FILTER },
        },
      },
      orders: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          folio: true,
          title: true,
          amountCents: true,
          status: true,
          createdAt: true,
        },
      },
      disputes: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          urgency: true,
          createdAt: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          fileUrl: true,
          reviewedAt: true,
          reviewedBy: { select: { name: true } },
          notes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!business) {
    return svcFail("NOT_FOUND", "Business not found");
  }

  return svcOk({
    id: business.id,
    name: business.name,
    type: business.type,
    status: business.status,
    statusReason: business.statusReason,
    derivedStatus: toDerivedStatus(business.status, business._count.disputes),
    guaranteeType: business.guaranteeType,
    guaranteeNotes: business.guaranteeNotes,
    ownerName: business.owner.name,
    ownerEmail: business.owner.email,
    createdAt: business.createdAt,
    stripeAccountId: business.stripeAccountId,
    chargesEnabled: business.chargesEnabled,
    payoutsEnabled: business.payoutsEnabled,
    subscription: business.subscription
      ? {
          planCode: business.subscription.plan.code,
          status: business.subscription.status,
          renewsAt: business.subscription.renewsAt,
        }
      : null,
    ordersCount: business._count.orders,
    recentOrders: business.orders,
    disputes: {
      openCount: business._count.disputes,
      items: business.disputes,
    },
    documents: business.documents.map(({ reviewedBy, ...document }) => ({
      ...document,
      reviewedByName: reviewedBy?.name ?? null,
    })),
  });
}

export type CsvExportRows =
  | { tab: "businesses"; rows: BusinessRow[] }
  | { tab: "customers"; rows: CustomerRow[] }
  | { tab: "workers"; rows: WorkerRow[] };

export async function readCsvRows(
  deps: { db: DirectoryDb },
  input: { filters: UsersFiltersInput; cap: number },
): Promise<{ export: CsvExportRows; truncated: boolean }> {
  // Reading cap + 1 rows reports truncation without materializing the whole
  // dataset in memory.
  const take = input.cap + 1;
  const { filters } = input;

  if (filters.tab === "businesses") {
    const rows = await deps.db.business.findMany({
      where: buildBusinessWhere(filters),
      take,
      orderBy: listOrderBy,
      select: businessListSelect,
    });

    return {
      export: {
        tab: "businesses",
        rows: rows.slice(0, input.cap).map(toBusinessRow),
      },
      truncated: rows.length > input.cap,
    };
  }

  if (filters.tab === "customers") {
    const rows = await deps.db.user.findMany({
      where: buildCustomerWhere(filters),
      take,
      orderBy: listOrderBy,
      select: customerListSelect,
    });

    return {
      export: {
        tab: "customers",
        rows: rows.slice(0, input.cap).map(toCustomerRow),
      },
      truncated: rows.length > input.cap,
    };
  }

  const rows = await deps.db.worker.findMany({
    where: buildWorkerWhere(filters),
    take,
    orderBy: listOrderBy,
    select: workerListSelect,
  });

  return {
    export: { tab: "workers", rows: rows.slice(0, input.cap).map(toWorkerRow) },
    truncated: rows.length > input.cap,
  };
}
