import { tool } from "ai";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";
import type { CsvRowError } from "~/app/[locale]/dashboard/products/_components/product.schema";
import type { ServiceImportError } from "~/app/[locale]/dashboard/services/_components/service.schema";
import { parseInventorySpreadsheet } from "~/server/services/catalog/inventory-spreadsheet";
import { parseServiceSpreadsheet } from "~/server/services/catalog/service-spreadsheet";
import type {
  SpreadsheetFailure,
  SpreadsheetFile,
} from "~/server/services/catalog/spreadsheet-reader";
import type { AgentAttachmentStore } from "../agent-attachments";
import {
  runTool,
  type AgentCaller,
  type AgentToolFailure,
} from "../tool-runtime";
import {
  attachmentNotFound,
  createListChatAttachmentsTool,
} from "./attachment-tools";

/** `product.importCsv` and `service.importRows` take at most 500 rows. */
const IMPORT_CHUNK_ROWS = 500;
const PREVIEW_SAMPLE_ROWS = 10;
const REPORTED_ERRORS = 30;

const spreadsheetSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      "Exact filename of the spreadsheet attached in this conversation",
    ),
  sheet: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Worksheet name. Omit to use the first sheet with data."),
});

const productImportSchema = spreadsheetSchema.extend({
  branchId: recordIdSchema.describe(
    "Branch whose stock the file sets (from listBranches)",
  ),
});

/** What every catalog parser returns once the sheet was read. */
type CatalogParse<TRow, TError> = {
  sheets: string[];
  sheet: string;
  columns: Record<string, string>;
  totalRows: number;
  valid: TRow[];
  errors: TError[];
};

type ParseResult<TRow, TError> =
  { ok: true; data: CatalogParse<TRow, TError> } | SpreadsheetFailure;

type ParseOutcome<TRow, TError> =
  | { ok: true; parse: CatalogParse<TRow, TError> }
  | { ok: false; failure: AgentToolFailure };

function parseFailure(result: SpreadsheetFailure): AgentToolFailure {
  const details = [
    result.missingColumns?.length
      ? `missingColumns=${result.missingColumns.join(",")}`
      : null,
    result.sheets?.length ? `sheets=${result.sheets.join(",")}` : null,
  ].filter(Boolean);

  return {
    result: null,
    error: result.code,
    status: 400,
    message: details.length
      ? `${result.message} (${details.join("; ")})`
      : result.message,
  };
}

async function parseAttachment<TRow, TError>(
  attachments: AgentAttachmentStore,
  filename: string,
  parse: (file: SpreadsheetFile) => Promise<ParseResult<TRow, TError>>,
): Promise<ParseOutcome<TRow, TError>> {
  const attachment = attachments.get(filename);

  if (!attachment) {
    return {
      ok: false,
      failure: attachmentNotFound(
        [filename],
        [...attachments.keys()],
        "Ask the user to attach the Excel (.xlsx) or CSV file.",
      ),
    };
  }

  const result = await parse(attachment);

  return result.ok
    ? { ok: true, parse: result.data }
    : { ok: false, failure: parseFailure(result) };
}

function previewResult<TRow, TError>(parse: CatalogParse<TRow, TError>) {
  return {
    result: {
      sheets: parse.sheets,
      sheet: parse.sheet,
      columns: parse.columns,
      totalRows: parse.totalRows,
      validRows: parse.valid.length,
      invalidRows: parse.errors.length,
      errors: parse.errors.slice(0, REPORTED_ERRORS),
      sample: parse.valid.slice(0, PREVIEW_SAMPLE_ROWS),
    },
    error: null,
    status: 200,
    message: "Spreadsheet parsed",
  };
}

function noValidRows(invalid: number): AgentToolFailure {
  return {
    result: null,
    error: "NO_VALID_ROWS",
    status: 400,
    message: `The spreadsheet has no valid rows to import (${invalid} invalid). Run the preview tool to show the row errors.`,
  };
}

type ImportChunkResponse<TError> = {
  result: { created: number; updated: number; errors: TError[] } | null;
  error: string | null;
  status: number;
  message: string;
};

/**
 * Writes the parsed rows through the import procedure in 500-row chunks.
 * Each chunk is its own transaction: on a failure the earlier chunks stay
 * committed and the model is told exactly how far the import got.
 */
async function importInChunks<
  TRow extends { line: number },
  TError extends { line: number },
>(
  parse: CatalogParse<TRow, TError>,
  write: (rows: TRow[]) => Promise<ImportChunkResponse<TError>>,
) {
  if (parse.valid.length === 0) {
    return noValidRows(parse.errors.length);
  }

  let created = 0;
  let updated = 0;
  const errors: TError[] = [...parse.errors];

  for (
    let offset = 0;
    offset < parse.valid.length;
    offset += IMPORT_CHUNK_ROWS
  ) {
    const response = await write(
      parse.valid.slice(offset, offset + IMPORT_CHUNK_ROWS),
    );

    if (!response.result) {
      return {
        result: null,
        error: response.error ?? "INTERNAL_ERROR",
        status: response.status,
        message: `${response.message}. Imported before the failure: ${created} created, ${updated} updated (rows up to line ${
          parse.valid[offset - 1]?.line ?? "none"
        }).`,
      } satisfies AgentToolFailure;
    }

    created += response.result.created;
    updated += response.result.updated;
    errors.push(...response.result.errors);
  }

  return {
    result: {
      sheet: parse.sheet,
      created,
      updated,
      skipped: errors.length,
      errors: errors.sort((a, b) => a.line - b.line).slice(0, REPORTED_ERRORS),
    },
    error: null,
    status: 200,
    message: "Spreadsheet imported",
  };
}

/**
 * Bulk catalog load (products with stock, services) from spreadsheets
 * attached in the chat. Parsing runs server-side on the attachment store, so
 * the file bytes never enter the model context; writes go through the same
 * `business` procedures as the dashboard (tenant scoping, plan state, stock
 * audit).
 */
export function createCatalogImportTools(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
) {
  return {
    listChatAttachments: createListChatAttachmentsTool(
      attachments,
      "Files the user attached in this conversation (name, type, size). Use it to find the exact filename of a spreadsheet to import.",
    ),

    // Products and stock
    previewInventoryImport: tool({
      description:
        "Read an Excel (.xlsx) or CSV of PRODUCTS attached in this conversation WITHOUT writing anything: detected columns, row counts, invalid rows with their spreadsheet line and a sample of the parsed products (price in MXN cents). Always run it before importInventorySpreadsheet and show the summary to the user.",
      inputSchema: spreadsheetSchema,
      execute: ({ filename, sheet }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, (file) =>
            parseInventorySpreadsheet(file, sheet),
          );
          return outcome.ok ? previewResult(outcome.parse) : outcome.failure;
        }),
    }),
    importInventorySpreadsheet: tool({
      description:
        "Bulk-load the PRODUCTS of a spreadsheet attached in this conversation into one branch: new SKUs are created as DRAFT, existing SKUs get name, category, price and that branch's stock overwritten (audited stock adjustment). Invalid rows are skipped and reported. Only after previewInventoryImport and the user's explicit confirmation of file, sheet and branch in a previous turn.",
      inputSchema: productImportSchema,
      execute: ({ filename, sheet, branchId }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, (file) =>
            parseInventorySpreadsheet(file, sheet),
          );

          if (!outcome.ok) {
            return outcome.failure;
          }

          return importInChunks<
            (typeof outcome.parse.valid)[number],
            CsvRowError
          >(outcome.parse, (rows) =>
            caller.product.importCsv({ branchId, rows }),
          );
        }),
    }),

    // Services
    previewServiceImport: tool({
      description:
        "Read an Excel (.xlsx) or CSV of SERVICES attached in this conversation WITHOUT writing anything: detected columns (Servicio, Categoría, Precio, Duración, optional Duración máxima and Trabajadores), row counts, invalid rows with their spreadsheet line and a sample (price in MXN cents, durations in minutes). Always run it before importServicesSpreadsheet and show the summary to the user.",
      inputSchema: spreadsheetSchema,
      execute: ({ filename, sheet }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, (file) =>
            parseServiceSpreadsheet(file, sheet),
          );
          return outcome.ok ? previewResult(outcome.parse) : outcome.failure;
        }),
    }),
    importServicesSpreadsheet: tool({
      description:
        "Bulk-load the SERVICES of a spreadsheet attached in this conversation, matched by service name: new names are created ACTIVE, existing ones get category, price, durations and (when the row lists them) workers overwritten. Workers are matched by full name or invitation email; rows naming an unknown worker are skipped and reported. Only after previewServiceImport and the user's explicit confirmation in a previous turn.",
      inputSchema: spreadsheetSchema,
      execute: ({ filename, sheet }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, (file) =>
            parseServiceSpreadsheet(file, sheet),
          );

          if (!outcome.ok) {
            return outcome.failure;
          }

          return importInChunks<
            (typeof outcome.parse.valid)[number],
            ServiceImportError
          >(outcome.parse, (rows) => caller.service.importRows({ rows }));
        }),
    }),
  };
}
