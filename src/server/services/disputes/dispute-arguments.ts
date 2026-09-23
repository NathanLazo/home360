import "server-only";

import {
  DisputeStatus,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import { isOwnedMediaPathname } from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Hard cap so a dispute never accumulates an unbounded evidence list. */
const MAX_DISPUTE_EVIDENCE = 30;

const disputeViewSelect = {
  id: true,
  orderId: true,
  title: true,
  status: true,
  urgency: true,
  customerArgument: true,
  businessArgument: true,
  evidenceUrls: true,
  resolution: true,
  resolutionAmountCents: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DisputeSelect;

/** What both parties may see: never admin notes or the AI summary. */
export type DisputeView = Prisma.DisputeGetPayload<{
  select: typeof disputeViewSelect;
}>;

type DisputeParty =
  | { kind: "CUSTOMER"; userId: string }
  | { kind: "BUSINESS"; businessId: string; userId: string };

function partyWhere(party: DisputeParty): Prisma.DisputeWhereInput {
  return party.kind === "CUSTOMER"
    ? { order: { is: { customerId: party.userId } } }
    : { businessId: party.businessId };
}

function ownsEvidence(userId: string, pathnames: string[]): boolean {
  return pathnames.every((pathname) =>
    isOwnedMediaPathname(pathname, userId, [
      "evidence",
      "requestPhoto",
      "requestVideo",
      "chatAttachment",
    ]),
  );
}

/** Dispute of an order the caller is party to; foreign ids are NOT_FOUND. */
export async function getDisputeByOrder(
  db: PrismaClient,
  party: DisputeParty,
  orderId: string,
): Promise<ServiceResult<DisputeView>> {
  const dispute = await db.dispute.findFirst({
    where: { orderId, ...partyWhere(party) },
    select: disputeViewSelect,
  });

  if (!dispute) {
    return svcFail("NOT_FOUND", "Dispute not found");
  }

  return svcOk(dispute);
}

/**
 * Adds a party's argument and/or evidence while the dispute is unresolved.
 * The customer argument is written at opening and only extended with
 * evidence; the business writes (or rewrites) its single `businessArgument`.
 * Evidence pathnames must live in the caller's own media namespace.
 */
export async function addDisputeArgument(
  db: PrismaClient,
  party: DisputeParty,
  input: { orderId: string; argument?: string; evidencePathnames: string[] },
): Promise<ServiceResult<DisputeView, "VALIDATION_ERROR">> {
  if (!ownsEvidence(party.userId, input.evidencePathnames)) {
    return svcFail("VALIDATION_ERROR", "Invalid evidence pathname");
  }

  if (
    party.kind === "CUSTOMER" &&
    input.argument !== undefined &&
    input.evidencePathnames.length === 0
  ) {
    return svcFail(
      "VALIDATION_ERROR",
      "Customers extend their dispute with evidence",
    );
  }

  return db.$transaction(async (tx) => {
    const dispute = await tx.dispute.findFirst({
      where: { orderId: input.orderId, ...partyWhere(party) },
      select: { id: true, status: true, evidenceUrls: true },
    });

    if (!dispute) {
      return svcFail("NOT_FOUND", "Dispute not found");
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      return svcFail("CONFLICT", "Dispute is already resolved");
    }

    const evidenceUrls = [
      ...new Set([...dispute.evidenceUrls, ...input.evidencePathnames]),
    ];

    if (evidenceUrls.length > MAX_DISPUTE_EVIDENCE) {
      return svcFail("VALIDATION_ERROR", "Too much evidence");
    }

    const updated = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        evidenceUrls,
        ...(party.kind === "BUSINESS" && input.argument !== undefined
          ? { businessArgument: input.argument }
          : {}),
      },
      select: disputeViewSelect,
    });

    return svcOk(updated);
  });
}
