import "server-only";

import {
  Prisma,
  type PrismaClient,
  type ServiceStatus,
} from "@generated/prisma";
import type {
  ServiceCreateInput,
  ServiceListInput,
  ServiceUpdateInput,
} from "~/app/[locale]/dashboard/services/_components/service.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { ACTIVE_ORDER_STATUSES } from "~/server/services/business/order-activity";

const PAGE_SIZE = 20;

const serviceListSelect = {
  id: true,
  name: true,
  category: true,
  basePriceCents: true,
  durationMinutes: true,
  durationMaxMinutes: true,
  status: true,
  createdAt: true,
  workers: {
    select: { id: true, fullName: true },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ServiceSelect;

export type ServiceListItem = Prisma.ServiceGetPayload<{
  select: typeof serviceListSelect;
}>;

type ServiceListResult = {
  items: ServiceListItem[];
  nextCursor: string | null;
};

async function workersBelongToBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
  workerIds: readonly string[],
): Promise<boolean> {
  if (workerIds.length === 0) {
    return true;
  }

  const uniqueWorkerIds = [...new Set(workerIds)];
  const workers = await tx.worker.count({
    where: { id: { in: uniqueWorkerIds }, businessId },
  });

  return workers === uniqueWorkerIds.length;
}

export async function listServices(
  db: PrismaClient,
  businessId: string,
  input: ServiceListInput,
): Promise<TrpcResponse<ServiceListResult>> {
  if (input.cursor) {
    const cursor = await db.service.findFirst({
      where: { id: input.cursor, businessId },
      select: { id: true },
    });

    if (!cursor) {
      return fail("NOT_FOUND", 404, "Service cursor not found");
    }
  }

  const rows = await db.service.findMany({
    where: {
      businessId,
      ...(input.search
        ? { name: { contains: input.search, mode: "insensitive" } }
        : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: serviceListSelect,
  });
  const hasNextPage = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE);

  return ok(
    {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
    "Services loaded",
  );
}

export async function listServiceCategories(
  db: PrismaClient,
  businessId: string,
): Promise<TrpcResponse<string[]>> {
  const categories = await db.service.groupBy({
    by: ["category"],
    where: { businessId },
    orderBy: { category: "asc" },
  });

  return ok(
    categories.map(({ category }) => category),
    "Service categories loaded",
  );
}

export async function listServiceWorkers(
  db: PrismaClient,
  businessId: string,
): Promise<TrpcResponse<Array<{ id: string; fullName: string }>>> {
  const workers = await db.worker.findMany({
    where: { businessId },
    select: { id: true, fullName: true },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  return ok(workers, "Service workers loaded");
}

export async function createService(
  db: PrismaClient,
  businessId: string,
  input: ServiceCreateInput,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    if (!(await workersBelongToBusiness(tx, businessId, input.workerIds))) {
      return fail(
        "VALIDATION_ERROR",
        422,
        "Some workers do not belong to the business",
      );
    }

    const service = await tx.service.create({
      data: {
        name: input.name,
        category: input.category,
        basePriceCents: input.basePriceCents,
        durationMinutes: input.durationMinutes,
        durationMaxMinutes: input.durationMaxMinutes,
        businessId,
        workers: { connect: input.workerIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });

    return ok(service, "Service created", 201);
  });
}

export async function updateService(
  db: PrismaClient,
  businessId: string,
  input: ServiceUpdateInput,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const current = await tx.service.findFirst({
      where: { id: input.id, businessId },
      select: { id: true, durationMinutes: true, durationMaxMinutes: true },
    });

    if (!current) {
      return fail("NOT_FOUND", 404, "Service not found");
    }

    const durationMinutes = input.durationMinutes ?? current.durationMinutes;
    const durationMaxMinutes =
      input.durationMaxMinutes === undefined
        ? current.durationMaxMinutes
        : input.durationMaxMinutes;

    if (durationMaxMinutes !== null && durationMaxMinutes < durationMinutes) {
      return fail(
        "VALIDATION_ERROR",
        422,
        "Maximum duration cannot be shorter than base duration",
      );
    }

    if (
      input.workerIds &&
      !(await workersBelongToBusiness(tx, businessId, input.workerIds))
    ) {
      return fail(
        "VALIDATION_ERROR",
        422,
        "Some workers do not belong to the business",
      );
    }

    const service = await tx.service.update({
      where: { id: input.id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.basePriceCents !== undefined
          ? { basePriceCents: input.basePriceCents }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.durationMaxMinutes !== undefined
          ? { durationMaxMinutes: input.durationMaxMinutes }
          : {}),
        ...(input.workerIds
          ? { workers: { set: input.workerIds.map((id) => ({ id })) } }
          : {}),
      },
      select: { id: true },
    });

    return ok(service, "Service updated");
  });
}

export async function setServiceStatus(
  db: PrismaClient,
  businessId: string,
  input: { id: string; status: ServiceStatus },
): Promise<TrpcResponse<{ id: string; status: ServiceStatus }>> {
  try {
    const service = await db.service.update({
      where: { id: input.id, businessId },
      data: { status: input.status },
      select: { id: true, status: true },
    });

    return ok(service, "Service status updated");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail("NOT_FOUND", 404, "Service not found");
    }

    throw error;
  }
}

export async function deleteService(
  db: PrismaClient,
  businessId: string,
  id: string,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const service = await tx.service.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!service) {
      return fail("NOT_FOUND", 404, "Service not found");
    }

    const activeOrders = await tx.order.count({
      where: {
        businessId,
        serviceId: id,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
    });

    if (activeOrders > 0) {
      return fail("CONFLICT", 409, "Service has active orders");
    }

    await tx.service.delete({ where: { id, businessId } });
    return ok({ id }, "Service deleted");
  });
}
