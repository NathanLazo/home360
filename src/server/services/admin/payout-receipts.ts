import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";

import { AdminAuditAction, type PrismaClient } from "@generated/prisma";

import { env } from "~/env";
import {
  PAYOUT_RECEIPT_CONTENT_TYPES,
  PAYOUT_RECEIPTS_PAGE_SIZE,
  PAYOUT_RECEIPT_MAX_SIZE_BYTES,
} from "~/schemas/admin/payout-receipt.schema";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { writeAdminAudit } from "./admin-audit";

/** Extension per allowed content type; keeps pathnames self-descriptive. */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Signed read URLs are short-lived: a fresh one is requested per view. */
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

const PATHNAME_PREFIX = "admin/payoutReceipt";

export type RegisterPayoutReceiptsInput = {
  adminId: string;
  withdrawalId?: string;
  loyaltyBonusId?: string;
  notes?: string;
  files: Array<{ filename: string; contentType: string; dataBase64: string }>;
};

type RegisterErrorCode =
  "PAYOUT_TARGET_REQUIRED" | "INVALID_RECEIPT_FILE" | "INTERNAL_ERROR";

/**
 * Registers proof-of-payment files against exactly one payout target (a
 * withdrawal or a loyalty bonus). Files are decoded server-side, stored as
 * private blobs under `admin/payoutReceipt/{businessId}/…` and linked in one
 * transaction together with the audit entry, so a registered receipt always
 * corresponds to a stored file.
 */
export async function registerPayoutReceipts(
  deps: { db: PrismaClient },
  input: RegisterPayoutReceiptsInput,
): Promise<
  ServiceResult<
    {
      businessId: string;
      receipts: Array<{ id: string; filename: string; sizeBytes: number }>;
    },
    RegisterErrorCode
  >
> {
  const target =
    input.withdrawalId !== undefined
      ? ({ type: "withdrawal", withdrawalId: input.withdrawalId } as const)
      : input.loyaltyBonusId !== undefined
        ? ({ type: "loyaltyBonus", bonusId: input.loyaltyBonusId } as const)
        : null;

  if (
    target === null ||
    (input.withdrawalId !== undefined && input.loyaltyBonusId !== undefined)
  ) {
    return svcFail("PAYOUT_TARGET_REQUIRED");
  }

  const readWriteToken = env.BLOB_READ_WRITE_TOKEN ?? null;

  if (!readWriteToken) {
    return svcFail("INTERNAL_ERROR", "Blob storage is not configured");
  }

  let businessId: string;

  if (target.type === "withdrawal") {
    const withdrawal = await deps.db.withdrawal.findUnique({
      where: { id: target.withdrawalId },
      select: { businessId: true },
    });

    if (!withdrawal) {
      return svcFail("NOT_FOUND");
    }

    businessId = withdrawal.businessId;
  } else {
    const bonus = await deps.db.loyaltyBonus.findUnique({
      where: { id: target.bonusId },
      select: { businessId: true },
    });

    if (!bonus) {
      return svcFail("NOT_FOUND");
    }

    businessId = bonus.businessId;
  }

  const decoded: Array<{
    filename: string;
    contentType: string;
    pathname: string;
    body: Buffer;
  }> = [];

  for (const file of input.files) {
    const extension = CONTENT_TYPE_EXTENSIONS[file.contentType];

    if (
      !extension ||
      !(PAYOUT_RECEIPT_CONTENT_TYPES as readonly string[]).includes(
        file.contentType,
      )
    ) {
      return svcFail("INVALID_RECEIPT_FILE", "Content type not allowed");
    }

    const body = Buffer.from(file.dataBase64, "base64");

    if (body.length === 0 || body.length > PAYOUT_RECEIPT_MAX_SIZE_BYTES) {
      return svcFail("INVALID_RECEIPT_FILE", "File size out of bounds");
    }

    decoded.push({
      filename: file.filename,
      contentType: file.contentType,
      pathname: `${PATHNAME_PREFIX}/${businessId}/${createId()}.${extension}`,
      body,
    });
  }

  // Uploads happen before the transaction; a failure here leaves at most a
  // few unreferenced blobs behind, never a receipt row without its file.
  for (const file of decoded) {
    await put(file.pathname, file.body, {
      access: "private",
      contentType: file.contentType,
      token: readWriteToken,
    });
  }

  const notes = input.notes?.trim() ?? "";
  const totalSizeBytes = decoded.reduce(
    (total, file) => total + file.body.length,
    0,
  );

  const receipts = await deps.db.$transaction(async (tx) => {
    const rows = await Promise.all(
      decoded.map((file) =>
        tx.payoutReceipt.create({
          data: {
            businessId,
            withdrawalId:
              target.type === "withdrawal" ? target.withdrawalId : null,
            loyaltyBonusId:
              target.type === "loyaltyBonus" ? target.bonusId : null,
            uploadedById: input.adminId,
            pathname: file.pathname,
            filename: file.filename,
            contentType: file.contentType,
            sizeBytes: file.body.length,
            notes: notes.length > 0 ? notes : null,
          },
          select: { id: true, filename: true, sizeBytes: true },
        }),
      ),
    );

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.PAYOUT_RECEIPT_REGISTERED,
      target,
      metadata: {
        businessId,
        receiptCount: rows.length,
        totalSizeBytes,
        notesPresent: notes.length > 0,
      },
    });

    return rows;
  });

  return svcOk({ businessId, receipts });
}

/**
 * Paginated receipts, newest first, filterable by withdrawal, loyalty bonus
 * or business. Without filters it lists the latest receipts of the platform.
 */
export async function listPayoutReceipts(
  deps: { db: PrismaClient },
  input: {
    withdrawalId?: string;
    loyaltyBonusId?: string;
    businessId?: string;
    cursor?: string;
  },
) {
  const rows = await deps.db.payoutReceipt.findMany({
    where: {
      ...(input.withdrawalId ? { withdrawalId: input.withdrawalId } : {}),
      ...(input.loyaltyBonusId ? { loyaltyBonusId: input.loyaltyBonusId } : {}),
      ...(input.businessId ? { businessId: input.businessId } : {}),
    },
    take: PAYOUT_RECEIPTS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      notes: true,
      createdAt: true,
      business: { select: { id: true, name: true } },
      withdrawal: { select: { id: true, amountCents: true, status: true } },
      loyaltyBonus: { select: { id: true, amountCents: true, status: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  const hasNextPage = rows.length > PAYOUT_RECEIPTS_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, PAYOUT_RECEIPTS_PAGE_SIZE) : rows;

  return svcOk({
    items: page.map(({ uploadedBy, ...receipt }) => ({
      ...receipt,
      uploadedByName: uploadedBy.name,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}

/**
 * Short-lived signed read URL for one receipt. The admin procedure is the
 * authorization boundary; the pathname always comes from the persisted row,
 * never from input.
 */
export async function getPayoutReceiptUrl(
  deps: { db: PrismaClient },
  input: { receiptId: string },
): Promise<
  ServiceResult<
    { url: string; filename: string; expiresAt: Date },
    "INTERNAL_ERROR"
  >
> {
  const receipt = await deps.db.payoutReceipt.findUnique({
    where: { id: input.receiptId },
    select: { pathname: true, filename: true },
  });

  if (!receipt) {
    return svcFail("NOT_FOUND");
  }

  const readWriteToken = env.BLOB_READ_WRITE_TOKEN ?? null;

  if (!readWriteToken) {
    return svcFail("INTERNAL_ERROR", "Blob storage is not configured");
  }

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MS);

  const signedToken = await issueSignedToken({
    token: readWriteToken,
    pathname: receipt.pathname,
    operations: ["get"],
    validUntil: expiresAt.getTime(),
  });

  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "get",
    pathname: receipt.pathname,
    access: "private",
    validUntil: expiresAt.getTime(),
  });

  return svcOk({ url: presignedUrl, filename: receipt.filename, expiresAt });
}
