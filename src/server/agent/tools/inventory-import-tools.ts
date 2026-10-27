import { tool } from "ai";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";
import type { CsvRowError } from "~/app/[locale]/dashboard/products/_components/product.schema";
import {
  parseInventorySpreadsheet,
  type InventorySpreadsheetResult,
} from "~/server/services/catalog/inventory-spreadsheet";
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

/** `product.importCsv` accepts at most 500 rows per call. */
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

const importSchema = spreadsheetSchema.extend({
  branchId: recordIdSchema.describe(
    "Branch whose stock the file sets (from listBranches)",
  ),
});

type ParseOutcome =
  | {
      ok: true;
      parse: Extract<InventorySpreadsheetResult, { ok: true }>["data"];
    }
  | { ok: false; failure: AgentToolFailure };

function parseFailure(
  result: Extract<InventorySpreadsheetResult, { ok: false }>,
): AgentToolFailure {
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

async function parseAttachment(
  attachments: AgentAttachmentStore,
  filename: string,
  sheet: string | undefined,
): Promise<ParseOutcome> {
  const attachment = attachments.get(filename);

  if (!attachment) {
    return {
      ok: false,
      failure: attachmentNotFound(
        [filename],
        [...attachments.keys()],
        "Ask the user to attach the Excel (.xlsx) or CSV inventory file.",
      ),
    };
  }

  const result = await parseInventorySpreadsheet(attachment, sheet);

  return result.ok
    ? { ok: true, parse: result.data }
    : { ok: false, failure: parseFailure(result) };
}

/**
 * Bulk inventory load from a spreadsheet attached in the chat. Parsing runs
 * server-side on the attachment store (the file bytes never enter the model
 * context); the write is the same `product.importCsv` procedure the dashboard
 * CSV dialog uses, so tenant scoping, plan state, stock audit (CSV_IMPORT)
 * and SKU upsert rules are identical.
 */
export function createInventoryImportTools(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
) {
  return {
    listChatAttachments: createListChatAttachmentsTool(
      attachments,
      "Files the user attached in this conversation (name, type, size). Use it to find the exact filename of an inventory spreadsheet.",
    ),
    previewInventoryImport: tool({
      description:
        "Read an Excel (.xlsx) or CSV inventory attached in this conversation WITHOUT writing anything: detected columns, row counts, invalid rows with their spreadsheet line and a sample of the parsed products (price in MXN cents). Always run it before importInventorySpreadsheet and show the summary to the user.",
      inputSchema: spreadsheetSchema,
      execute: ({ filename, sheet }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, sheet);

          if (!outcome.ok) {
            return outcome.failure;
          }

          const { parse } = outcome;

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
            message: "Inventory spreadsheet parsed",
          };
        }),
    }),
    importInventorySpreadsheet: tool({
      description:
        "Bulk-load the products of an inventory spreadsheet attached in this conversation into one branch: new SKUs are created as DRAFT, existing SKUs get name, category, price and that branch's stock overwritten (audited stock adjustment). Invalid rows are skipped and reported. Only after previewInventoryImport and the user's explicit confirmation of file, sheet and branch in a previous turn.",
      inputSchema: importSchema,
      execute: ({ filename, sheet, branchId }) =>
        runTool(async () => {
          const outcome = await parseAttachment(attachments, filename, sheet);

          if (!outcome.ok) {
            return outcome.failure;
          }

          const { parse } = outcome;

          if (parse.valid.length === 0) {
            return {
              result: null,
              error: "NO_VALID_ROWS",
              status: 400,
              message: `The spreadsheet has no valid product rows to import (${parse.errors.length} invalid). Run previewInventoryImport to show the row errors.`,
            } satisfies AgentToolFailure;
          }

          let created = 0;
          let updated = 0;
          const errors: CsvRowError[] = [...parse.errors];

          for (
            let offset = 0;
            offset < parse.valid.length;
            offset += IMPORT_CHUNK_ROWS
          ) {
            const rows = parse.valid.slice(offset, offset + IMPORT_CHUNK_ROWS);
            const response = await caller.product.importCsv({ branchId, rows });

            if (!response.result) {
              // Earlier chunks already committed: report them with the failure.
              return {
                result: null,
                error: response.error ?? "INTERNAL_ERROR",
                status: response.status,
                message: `${response.message}. Imported before the failure: ${created} created, ${updated} updated (rows up to line ${
                  parse.valid[offset - 1]?.line ?? "none"
                }).`,
              };
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
              errors: errors
                .sort((a, b) => a.line - b.line)
                .slice(0, REPORTED_ERRORS),
            },
            error: null,
            status: 200,
            message: "Inventory imported",
          };
        }),
    }),
  };
}
