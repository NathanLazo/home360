import "server-only";

import {
  Prisma,
  type BusinessStatus,
  type PrismaClient,
} from "@generated/prisma";
import type {
  TeamErrorCode,
  WorkerCreateInput,
  WorkerResendInvitationInput,
  WorkerUpdateInput,
} from "~/schemas/team/worker.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import type { EmailClient } from "~/server/services/email/email-client";
import {
  assertPlanLimit,
  type BusinessWithPlan,
} from "~/server/services/subscription/plan-limits";
import { env } from "~/env";
import { sendWorkerInvitation } from "~/server/services/team/send-worker-invitation";
import { issueWorkerInvitationUrl } from "~/server/services/team/worker-invitation-token";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";

/**
 * Business context as `businessProcedure` builds it (F0-05): the plan is already
 * flattened and the status decides whether new workers may be created at all.
 */
export type TeamBusiness = BusinessWithPlan & { status: BusinessStatus };

const workerListSelect = {
  id: true,
  fullName: true,
  specialty: true,
  invitedEmail: true,
  invitationStatus: true,
  availability: true,
  branch: { select: { id: true, name: true } },
  services: { select: { id: true, name: true, status: true } },
} satisfies Prisma.WorkerSelect;

type WorkerListRow = Prisma.WorkerGetPayload<{
  select: typeof workerListSelect;
}>;

export type WorkerListItem = WorkerListRow & {
  /** Orders assigned to the worker that are scheduled (or were created) today. */
  todayOrdersCount: number;
};

export type WorkerListResult = {
  items: WorkerListItem[];
  limit: { used: number; max: number | null; canCreate: boolean };
};

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function todayBounds(now: Date): { start: Date; end: Date } {
  // Server-calendar day, same convention as the branch monthly counters.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function countTodayOrdersByWorker(
  db: PrismaClient,
  businessId: string,
  workerIds: string[],
  now = new Date(),
): Promise<Map<string, number>> {
  if (workerIds.length === 0) {
    return new Map();
  }

  const { start, end } = todayBounds(now);
  const today = { gte: start, lt: end };
  const groups = await db.order.groupBy({
    by: ["workerId"],
    where: {
      businessId,
      workerId: { in: workerIds },
      status: { not: "CANCELLED" },
      OR: [
        { quote: { is: { scheduledFor: today } } },
        { quote: { is: { scheduledFor: null } }, createdAt: today },
        { quoteId: null, createdAt: today },
      ],
    },
    _count: { _all: true },
  });

  return new Map(
    groups.flatMap((group) =>
      group.workerId ? [[group.workerId, group._count._all] as const] : [],
    ),
  );
}

export async function listWorkers(
  db: PrismaClient,
  business: TeamBusiness,
): Promise<TrpcResponse<WorkerListResult>> {
  const rows = await db.worker.findMany({
    where: { businessId: business.id },
    select: workerListSelect,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });
  const todayCounts = await countTodayOrdersByWorker(
    db,
    business.id,
    rows.map(({ id }) => id),
  );
  const items = rows.map((row): WorkerListItem => ({
    ...row,
    todayOrdersCount: todayCounts.get(row.id) ?? 0,
  }));
  const used = items.length;
  const max = business.plan?.maxWorkers ?? null;
  // `max === null` is unlimited only when a subscription exists; a business
  // without a plan can never create workers.
  const canCreate =
    business.status === "ACTIVE" &&
    business.plan !== null &&
    (max === null || used < max);

  return ok({ items, limit: { used, max, canCreate } }, "Workers loaded");
}

async function assertBranchBelongsToBusiness(
  db: PrismaClient,
  businessId: string,
  branchId: string,
): Promise<boolean> {
  const branch = await db.branch.findFirst({
    where: { id: branchId, businessId },
    select: { id: true },
  });

  return branch !== null;
}

export async function createWorker(
  db: PrismaClient,
  business: TeamBusiness,
  emailClient: EmailClient | null,
  input: WorkerCreateInput,
): Promise<TrpcResponse<{ id: string }, TeamErrorCode>> {
  const limitFailure = await assertPlanLimit(db, business, "workers");

  if (limitFailure) {
    return fail(
      limitFailure.error ?? "PLAN_LIMIT_REACHED",
      limitFailure.status,
      limitFailure.message,
    );
  }

  const branchId = input.branchId ?? null;

  if (
    branchId !== null &&
    !(await assertBranchBelongsToBusiness(db, business.id, branchId))
  ) {
    return fail("NOT_FOUND", 404, "Branch not found");
  }

  const invitedEmail = input.invitedEmail ?? null;
  const worker = await db.worker.create({
    data: {
      businessId: business.id,
      fullName: input.fullName,
      branchId,
      specialty: input.specialty ?? null,
      invitedEmail,
      invitationStatus: invitedEmail === null ? "ACCEPTED" : "PENDING",
    },
    select: { id: true },
  });

  if (invitedEmail !== null) {
    const delivered = await deliverInvitation(db, emailClient, {
      businessId: business.id,
      workerId: worker.id,
      to: invitedEmail,
      workerName: input.fullName,
      locale: input.locale,
    });

    if (!delivered) {
      // The worker stays created on purpose: the invitation can be resent.
      return fail("EMAIL_SEND_FAILED", 502, "Worker invitation was not sent");
    }
  }

  return ok(worker, "Worker created", 201);
}

export async function updateWorker(
  db: PrismaClient,
  businessId: string,
  input: WorkerUpdateInput,
): Promise<TrpcResponse<{ id: string }>> {
  if (
    typeof input.branchId === "string" &&
    !(await assertBranchBelongsToBusiness(db, businessId, input.branchId))
  ) {
    return fail("NOT_FOUND", 404, "Branch not found");
  }

  const updated = await db.worker.updateMany({
    where: { id: input.id, businessId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.specialty !== undefined ? { specialty: input.specialty } : {}),
    },
  });

  if (updated.count === 0) {
    return fail("NOT_FOUND", 404, "Worker not found");
  }

  return ok({ id: input.id }, "Worker updated");
}

export async function deleteWorker(
  db: PrismaClient,
  businessId: string,
  id: string,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    // No database constraint can express this rule, so the check and the delete
    // share a transaction to narrow the race window.
    const activeServices = await tx.service.findMany({
      where: { businessId, status: "ACTIVE", workers: { some: { id } } },
      select: { id: true, name: true, _count: { select: { workers: true } } },
    });

    if (activeServices.some((service) => service._count.workers === 1)) {
      return fail(
        "CONFLICT",
        409,
        "worker is the only one assigned to active service(s)",
      );
    }

    try {
      await tx.worker.delete({ where: { id, businessId } });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return fail("NOT_FOUND", 404, "Worker not found");
      }

      throw error;
    }

    return ok({ id }, "Worker deleted");
  });
}

export async function resendWorkerInvitation(
  db: PrismaClient,
  businessId: string,
  emailClient: EmailClient | null,
  input: WorkerResendInvitationInput,
): Promise<TrpcResponse<{ id: string }, TeamErrorCode>> {
  const worker = await db.worker.findFirst({
    where: { id: input.id, businessId },
    select: {
      id: true,
      fullName: true,
      invitedEmail: true,
      invitationStatus: true,
    },
  });

  if (!worker) {
    return fail("NOT_FOUND", 404, "Worker not found");
  }

  if (worker.invitationStatus !== "PENDING" || worker.invitedEmail === null) {
    return fail("CONFLICT", 409, "Worker has no pending invitation");
  }

  const delivered = await deliverInvitation(db, emailClient, {
    businessId,
    workerId: worker.id,
    to: worker.invitedEmail,
    workerName: worker.fullName,
    locale: input.locale,
  });

  if (!delivered) {
    return fail("EMAIL_SEND_FAILED", 502, "Worker invitation was not sent");
  }

  return ok({ id: worker.id }, "Worker invitation resent");
}

/**
 * Sends the invitation and swallows provider details: callers only learn
 * whether it went out, never why it failed.
 */
async function deliverInvitation(
  db: PrismaClient,
  emailClient: EmailClient | null,
  input: {
    businessId: string;
    workerId: string;
    to: string;
    workerName: string;
    locale: WorkerCreateInput["locale"];
  },
): Promise<boolean> {
  try {
    const existingUser = await db.user.findUnique({
      where: { email: input.to },
      select: { id: true },
    });

    if (existingUser) {
      await sendLocalizedPushToUser(db, existingUser.id, {
        message: "workerInvitation",
        url: "home360app://team",
      });
    }
  } catch {
    console.error("[team] WORKER_INVITATION_PUSH_FAILED");
  }

  if (!emailClient) {
    console.error("[team] EMAIL_CLIENT_UNAVAILABLE");
    return false;
  }

  try {
    const business = await db.business.findUniqueOrThrow({
      where: { id: input.businessId },
      select: { name: true },
    });

    // Workstream D: single-use acceptance link (re-issued on every resend).
    const invitationUrl = await issueWorkerInvitationUrl(db, {
      workerId: input.workerId,
      appUrl: env.APP_URL,
      locale: input.locale,
    });

    await sendWorkerInvitation(emailClient, {
      to: input.to,
      workerName: input.workerName,
      businessName: business.name,
      locale: input.locale,
      ...(invitationUrl ? { invitationUrl } : {}),
    });

    return true;
  } catch {
    console.error("[team] WORKER_INVITATION_DELIVERY_FAILED");
    return false;
  }
}
