import "server-only";

import {
  OrderEventType,
  OrderStatus,
  OrderType,
  Prisma,
  type PrismaClient,
  type WorkerAvailability,
} from "../../../../generated/prisma";
import {
  createDownloadUrl,
  isOwnedMediaPathname,
} from "~/server/services/media/blob";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const assignedOrderSelect = {
  id: true,
  folio: true,
  title: true,
  status: true,
  createdAt: true,
  customer: { select: { name: true } },
  quote: {
    select: {
      scheduledFor: true,
      request: { select: { addressLine: true } },
    },
  },
} satisfies Prisma.OrderSelect;

const workerOrderDetailSelect = {
  id: true,
  folio: true,
  title: true,
  status: true,
  recordingUrl: true,
  recordingDurationSec: true,
  recordingComplete: true,
  beforeUrls: true,
  afterUrls: true,
  workNotes: true,
  customer: { select: { name: true } },
  quote: {
    select: {
      scheduledFor: true,
      message: true,
      request: {
        select: {
          description: true,
          addressLine: true,
          latitude: true,
          longitude: true,
          photoUrls: true,
        },
      },
    },
  },
  materials: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      quantity: true,
      unitPriceCents: true,
      productId: true,
    },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, createdAt: true },
  },
  recordingSegments: {
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      startLat: true,
      startLng: true,
      endLat: true,
      endLng: true,
      pathname: true,
      uploadedAt: true,
      interrupted: true,
    },
  },
} satisfies Prisma.OrderSelect;

type AssignedOrderRow = Prisma.OrderGetPayload<{
  select: typeof assignedOrderSelect;
}>;

type WorkerOrderDetailRow = Prisma.OrderGetPayload<{
  select: typeof workerOrderDetailSelect;
}>;

export type AssignedOrder = {
  id: string;
  folio: number;
  title: string;
  status: OrderStatus;
  scheduledFor: Date | null;
  addressLine: string | null;
  customerName: string | null;
  createdAt: Date;
};

export type WorkerEvidence = { pathname: string; url: string };

export type WorkerOrderDetail = Omit<
  WorkerOrderDetailRow,
  "quote" | "recordingUrl" | "beforeUrls" | "afterUrls"
> & {
  scheduledFor: Date | null;
  description: string | null;
  quoteMessage: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  requestEvidence: WorkerEvidence[];
  recordingPathname: string | null;
  beforePathnames: string[];
  afterPathnames: string[];
};

export type FinishMaterial = {
  productId?: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

function toAssignedOrder(order: AssignedOrderRow): AssignedOrder {
  return {
    id: order.id,
    folio: order.folio,
    title: order.title,
    status: order.status,
    scheduledFor: order.quote?.scheduledFor ?? null,
    addressLine: order.quote?.request.addressLine ?? null,
    customerName: order.customer.name,
    createdAt: order.createdAt,
  };
}

async function signEvidence(
  db: PrismaClient,
  userId: string,
  pathnames: string[],
): Promise<WorkerEvidence[]> {
  const evidence: WorkerEvidence[] = [];

  for (const pathname of pathnames) {
    const grant = await createDownloadUrl(db, { userId, pathname });

    if (grant.ok) {
      evidence.push({ pathname, url: grant.data.url });
    }
  }

  return evidence;
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function listAssignedOrders(
  db: PrismaClient,
  workerId: string,
): Promise<ServiceResult<AssignedOrder[]>> {
  const orders = await db.order.findMany({
    where: { workerId, type: OrderType.SERVICE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: assignedOrderSelect,
  });

  return svcOk(orders.map(toAssignedOrder));
}

export async function getAssignedOrderById(
  db: PrismaClient,
  input: { workerId: string; userId: string; orderId: string },
): Promise<ServiceResult<WorkerOrderDetail>> {
  const order = await db.order.findFirst({
    where: {
      id: input.orderId,
      workerId: input.workerId,
      type: OrderType.SERVICE,
    },
    select: workerOrderDetailSelect,
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  const requestEvidence = await signEvidence(
    db,
    input.userId,
    order.quote?.request.photoUrls ?? [],
  );

  return svcOk({
    id: order.id,
    folio: order.folio,
    title: order.title,
    status: order.status,
    recordingDurationSec: order.recordingDurationSec,
    recordingComplete: order.recordingComplete,
    workNotes: order.workNotes,
    customer: order.customer,
    materials: order.materials,
    events: order.events,
    recordingSegments: order.recordingSegments,
    scheduledFor: order.quote?.scheduledFor ?? null,
    description: order.quote?.request.description ?? null,
    quoteMessage: order.quote?.message ?? null,
    addressLine: order.quote?.request.addressLine ?? null,
    latitude: order.quote?.request.latitude ?? null,
    longitude: order.quote?.request.longitude ?? null,
    requestEvidence,
    recordingPathname: order.recordingUrl,
    beforePathnames: order.beforeUrls,
    afterPathnames: order.afterUrls,
  });
}

export async function transitionAssignedOrder(
  db: PrismaClient,
  input: {
    workerId: string;
    actorUserId: string;
    orderId: string;
    to: typeof OrderEventType.EN_ROUTE | typeof OrderEventType.ARRIVED;
  },
): Promise<ServiceResult<{ orderId: string; event: OrderEventType }>> {
  try {
    const transitioned = await db.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: input.orderId,
            workerId: input.workerId,
            type: OrderType.SERVICE,
          },
          select: {
            id: true,
            status: true,
            customerId: true,
            events: { select: { type: true } },
          },
        });

        if (!order) {
          return svcFail("NOT_FOUND", "Order not found");
        }

        const eventTypes = new Set(order.events.map((event) => event.type));
        const valid =
          input.to === OrderEventType.EN_ROUTE
            ? order.status === OrderStatus.PAID &&
              eventTypes.has(OrderEventType.ACCEPTED) &&
              !eventTypes.has(OrderEventType.EN_ROUTE)
            : order.status === OrderStatus.IN_PROGRESS &&
              eventTypes.has(OrderEventType.EN_ROUTE) &&
              !eventTypes.has(OrderEventType.ARRIVED);

        if (!valid) {
          return svcFail("CONFLICT", "Order transition is out of sequence");
        }

        if (input.to === OrderEventType.EN_ROUTE) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.IN_PROGRESS },
          });
        }

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: input.to,
            actorUserId: input.actorUserId,
          },
        });

        return svcOk({
          orderId: order.id,
          customerId: order.customerId,
          event: input.to,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!transitioned.ok) {
      return transitioned;
    }

    await sendLocalizedPushToUser(db, transitioned.data.customerId, {
      message:
        input.to === OrderEventType.EN_ROUTE ? "orderEnRoute" : "orderArrived",
      url: `home360app://orders/${transitioned.data.orderId}`,
    });

    return svcOk({
      orderId: transitioned.data.orderId,
      event: transitioned.data.event,
    });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Order transition conflicted");
    }

    throw error;
  }
}

export async function startOrderRecording(
  db: PrismaClient,
  input: {
    workerId: string;
    actorUserId: string;
    orderId: string;
    startLat: number;
    startLng: number;
  },
): Promise<ServiceResult<{ segmentId: string; startedAt: Date }>> {
  try {
    return await db.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: input.orderId,
            workerId: input.workerId,
            type: OrderType.SERVICE,
          },
          select: {
            id: true,
            status: true,
            events: { select: { type: true } },
            recordingSegments: {
              where: { endedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        });

        if (!order) {
          return svcFail("NOT_FOUND", "Order not found");
        }

        if (
          order.status !== OrderStatus.IN_PROGRESS ||
          !order.events.some(
            (event) => event.type === OrderEventType.ARRIVED,
          ) ||
          order.events.some(
            (event) => event.type === OrderEventType.WORK_DONE,
          ) ||
          order.recordingSegments.length > 0
        ) {
          return svcFail("CONFLICT", "Recording cannot be started");
        }

        const startedAt = new Date();
        const segment = await tx.recordingSegment.create({
          data: {
            orderId: order.id,
            startedAt,
            startLat: input.startLat,
            startLng: input.startLng,
          },
          select: { id: true },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.RECORDING_STARTED,
            actorUserId: input.actorUserId,
          },
        });

        return svcOk({ segmentId: segment.id, startedAt });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Recording start conflicted");
    }

    throw error;
  }
}

export async function stopOrderRecording(
  db: PrismaClient,
  input: {
    workerId: string;
    actorUserId: string;
    segmentId: string;
    pathname?: string;
    interrupted: boolean;
    endLat: number;
    endLng: number;
  },
): Promise<
  ServiceResult<
    {
      segmentId: string;
      endedAt: Date;
      durationSec: number;
      recordingComplete: boolean;
    },
    "VALIDATION_ERROR"
  >
> {
  if (
    (!input.interrupted && input.pathname === undefined) ||
    (input.pathname !== undefined &&
      !isOwnedMediaPathname(input.pathname, input.actorUserId, ["recording"]))
  ) {
    return svcFail("VALIDATION_ERROR", "Invalid recording pathname");
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const segment = await tx.recordingSegment.findFirst({
          where: {
            id: input.segmentId,
            endedAt: null,
            order: {
              is: {
                workerId: input.workerId,
                type: OrderType.SERVICE,
              },
            },
          },
          select: { id: true, orderId: true, startedAt: true },
        });

        if (!segment) {
          return svcFail("NOT_FOUND", "Recording segment not found");
        }

        const endedAt = new Date();
        await tx.recordingSegment.update({
          where: { id: segment.id },
          data: {
            endedAt,
            endLat: input.endLat,
            endLng: input.endLng,
            pathname: input.pathname,
            uploadedAt: input.pathname === undefined ? null : endedAt,
            interrupted: input.interrupted,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: segment.orderId,
            type: OrderEventType.RECORDING_STOPPED,
            actorUserId: input.actorUserId,
          },
        });

        const segments = await tx.recordingSegment.findMany({
          where: { orderId: segment.orderId },
          select: {
            startedAt: true,
            endedAt: true,
            pathname: true,
            uploadedAt: true,
            interrupted: true,
          },
        });
        const durationSec = segments.reduce((total, item) => {
          if (!item.endedAt) {
            return total;
          }

          return (
            total +
            Math.max(
              0,
              Math.round(
                (item.endedAt.getTime() - item.startedAt.getTime()) / 1_000,
              ),
            )
          );
        }, 0);
        const recordingComplete =
          segments.length > 0 &&
          segments.every(
            (item) =>
              item.endedAt !== null &&
              item.pathname !== null &&
              item.uploadedAt !== null &&
              !item.interrupted,
          );

        await tx.order.update({
          where: { id: segment.orderId },
          data: {
            ...(input.pathname === undefined
              ? {}
              : { recordingUrl: input.pathname }),
            recordingDurationSec: durationSec,
            recordingComplete,
          },
        });

        return svcOk({
          segmentId: segment.id,
          endedAt,
          durationSec,
          recordingComplete,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Recording stop conflicted");
    }

    throw error;
  }
}

export async function finishAssignedOrder(
  db: PrismaClient,
  input: {
    workerId: string;
    actorUserId: string;
    orderId: string;
    beforePathnames: string[];
    afterPathnames: string[];
    workNotes: string;
    materials: FinishMaterial[];
  },
): Promise<
  ServiceResult<
    { orderId: string },
    "RECORDING_JUSTIFICATION_REQUIRED" | "VALIDATION_ERROR"
  >
> {
  const evidencePathnames = [...input.beforePathnames, ...input.afterPathnames];

  if (
    evidencePathnames.some(
      (pathname) =>
        !isOwnedMediaPathname(pathname, input.actorUserId, ["evidence"]),
    )
  ) {
    return svcFail("VALIDATION_ERROR", "Invalid evidence pathname");
  }

  try {
    const finished = await db.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: input.orderId,
            workerId: input.workerId,
            type: OrderType.SERVICE,
          },
          select: {
            id: true,
            status: true,
            businessId: true,
            customerId: true,
            events: { select: { type: true } },
            recordingSegments: {
              select: { endedAt: true, pathname: true, uploadedAt: true },
            },
          },
        });

        if (!order) {
          return svcFail("NOT_FOUND", "Order not found");
        }

        if (
          order.status !== OrderStatus.IN_PROGRESS ||
          order.events.some((event) => event.type === OrderEventType.WORK_DONE)
        ) {
          return svcFail("CONFLICT", "Order cannot be finished");
        }

        const hasOpenSegment = order.recordingSegments.some(
          (segment) => segment.endedAt === null,
        );
        const hasUploadedSegment = order.recordingSegments.some(
          (segment) =>
            segment.endedAt !== null &&
            segment.pathname !== null &&
            segment.uploadedAt !== null,
        );

        if (hasOpenSegment || !hasUploadedSegment) {
          return svcFail(
            "RECORDING_JUSTIFICATION_REQUIRED",
            "A closed uploaded recording is required",
          );
        }

        const productIds = [
          ...new Set(
            input.materials.flatMap((material) =>
              material.productId === undefined ? [] : [material.productId],
            ),
          ),
        ];

        if (productIds.length > 0) {
          const ownedProducts = await tx.product.count({
            where: { id: { in: productIds }, businessId: order.businessId },
          });

          if (ownedProducts !== productIds.length) {
            return svcFail("VALIDATION_ERROR", "Invalid material product");
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            beforeUrls: input.beforePathnames,
            afterUrls: input.afterPathnames,
            workNotes: input.workNotes,
            materials: {
              deleteMany: {},
              create: input.materials.map((material) => ({
                name: material.name,
                quantity: material.quantity,
                unitPriceCents: material.unitPriceCents,
                ...(material.productId === undefined
                  ? {}
                  : { productId: material.productId }),
              })),
            },
          },
        });

        await tx.orderEvent.createMany({
          data: [
            {
              orderId: order.id,
              type: OrderEventType.WORK_DONE,
              actorUserId: input.actorUserId,
            },
            {
              orderId: order.id,
              type: OrderEventType.CONFIRMATION_REQUESTED,
              actorUserId: input.actorUserId,
            },
          ],
        });

        return svcOk({ orderId: order.id, customerId: order.customerId });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!finished.ok) {
      return finished;
    }

    await sendLocalizedPushToUser(db, finished.data.customerId, {
      message: "confirmationRequested",
      url: `home360app://orders/${finished.data.orderId}`,
    });

    return svcOk({ orderId: finished.data.orderId });
  } catch (error) {
    if (isSerializationConflict(error)) {
      return svcFail("CONFLICT", "Order finish conflicted");
    }

    throw error;
  }
}

export async function setWorkerAvailability(
  db: PrismaClient,
  input: { workerId: string; availability: WorkerAvailability },
): Promise<ServiceResult<{ availability: WorkerAvailability }>> {
  const updated = await db.worker.updateMany({
    where: { id: input.workerId },
    data: { availability: input.availability },
  });

  if (updated.count === 0) {
    return svcFail("NOT_FOUND", "Worker not found");
  }

  return svcOk({ availability: input.availability });
}
