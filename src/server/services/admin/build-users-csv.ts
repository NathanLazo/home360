import type { CsvExportRows } from "./user-directory";

/**
 * CSV headers are a stable data-export contract, not UI copy: they stay in
 * English and are never translated.
 */
const CSV_HEADERS = {
  businesses: [
    "id",
    "name",
    "type",
    "status",
    "derivedStatus",
    "guaranteeType",
    "ownerName",
    "ownerEmail",
    "ordersCount",
    "openDisputesCount",
    "pendingDocumentsCount",
    "createdAt",
  ],
  customers: [
    "id",
    "name",
    "email",
    "accessStatus",
    "ordersCount",
    "createdAt",
  ],
  workers: [
    "id",
    "fullName",
    "businessName",
    "branchName",
    "specialty",
    "availability",
    "accessStatus",
    "createdAt",
  ],
} as const;

const ROW_SEPARATOR = "\r\n";

/** RFC 4180: quote every field and double any embedded quote. */
function escapeField(value: string | number | null | Date): string {
  if (value === null) {
    return '""';
  }

  const text =
    value instanceof Date ? value.toISOString() : String(value).trim();

  return `"${text.replaceAll('"', '""')}"`;
}

function toLine(fields: Array<string | number | null | Date>): string {
  return fields.map(escapeField).join(",");
}

export function buildUsersCsv(input: CsvExportRows): string {
  if (input.tab === "businesses") {
    return [
      CSV_HEADERS.businesses.join(","),
      ...input.rows.map((row) =>
        toLine([
          row.id,
          row.name,
          row.type,
          row.status,
          row.derivedStatus,
          row.guaranteeType,
          row.ownerName,
          row.ownerEmail,
          row.ordersCount,
          row.openDisputesCount,
          row.pendingDocumentsCount,
          row.createdAt,
        ]),
      ),
    ].join(ROW_SEPARATOR);
  }

  if (input.tab === "customers") {
    return [
      CSV_HEADERS.customers.join(","),
      ...input.rows.map((row) =>
        toLine([
          row.id,
          row.name,
          row.email,
          row.accessStatus,
          row.ordersCount,
          row.createdAt,
        ]),
      ),
    ].join(ROW_SEPARATOR);
  }

  return [
    CSV_HEADERS.workers.join(","),
    ...input.rows.map((row) =>
      toLine([
        row.id,
        row.fullName,
        row.businessName,
        row.branchName,
        row.specialty,
        row.availability,
        row.accessStatus,
        row.createdAt,
      ]),
    ),
  ].join(ROW_SEPARATOR);
}

export function buildCsvFilename(tab: CsvExportRows["tab"], now: Date): string {
  const isoDate = now.toISOString().slice(0, 10);
  return `home360-${tab}-${isoDate}.csv`;
}
