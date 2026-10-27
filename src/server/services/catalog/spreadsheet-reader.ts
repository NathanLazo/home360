import ExcelJS from "exceljs";
import Papa from "papaparse";

export const SPREADSHEET_MAX_BYTES = 10 * 1024 * 1024;

/** How far down the sheet the header row is searched (titles, logos…). */
const HEADER_SCAN_ROWS = 10;

const XLSX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type SpreadsheetFile = {
  filename: string;
  mediaType: string;
  dataBase64: string;
};

export type SpreadsheetErrorCode =
  | "UNSUPPORTED_SPREADSHEET_TYPE"
  | "CSV_FILE_TOO_LARGE"
  | "CSV_PARSE_ERROR"
  | "SHEET_NOT_FOUND"
  | "CSV_MISSING_COLUMN"
  | "CSV_TOO_MANY_ROWS";

export type SpreadsheetFailure = {
  ok: false;
  code: SpreadsheetErrorCode;
  message: string;
  missingColumns?: string[];
  sheets?: string[];
};

/** Column layout of one import kind (products, services…). */
export type SpreadsheetLayout<TColumn extends string> = {
  /** Normalized header (lowercase, no accents, `_`) → canonical column. */
  aliases: Readonly<Record<string, TColumn>>;
  required: readonly TColumn[];
  maxRows: number;
  /** Shown to the model when columns are missing. */
  expectedHeaders: string;
};

export type SpreadsheetRow<TColumn extends string> = {
  /** Spreadsheet row number, as the user sees it. */
  line: number;
  record: Partial<Record<TColumn, string>>;
};

export type SpreadsheetTable<TColumn extends string> = {
  sheets: string[];
  sheet: string;
  /** Spreadsheet header text → canonical column it was matched to. */
  columns: Record<string, TColumn>;
  rows: SpreadsheetRow<TColumn>[];
};

export type SpreadsheetReadResult<TColumn extends string> =
  { ok: true; data: SpreadsheetTable<TColumn> } | SpreadsheetFailure;

type RawSheet = {
  name: string;
  rows: Array<{ line: number; cells: string[] }>;
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function spreadsheetKind(file: SpreadsheetFile): "xlsx" | "csv" | null {
  const extension = file.filename.toLowerCase().split(".").pop();

  if (file.mediaType === XLSX_MEDIA_TYPE || extension === "xlsx") {
    return "xlsx";
  }

  if (file.mediaType === "text/csv" || extension === "csv") {
    return "csv";
  }

  return null;
}

/** Excel cell → plain text (`125.5`, `10`, `Tubo`). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    // Float noise from Excel (125.49999…) never reaches the parsers.
    return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(2)));
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if ("richText" in value) {
    return value.richText
      .map(({ text }) => text)
      .join("")
      .trim();
  }

  if ("result" in value) {
    const result = value.result;
    return result === undefined || typeof result === "object"
      ? ""
      : cellText(result);
  }

  if ("text" in value) {
    return typeof value.text === "string" ? value.text.trim() : "";
  }

  return "";
}

async function readXlsx(buffer: Buffer): Promise<RawSheet[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs types its input as an ArrayBuffer; copy out of Node's pooled Buffer.
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  await workbook.xlsx.load(arrayBuffer);

  return workbook.worksheets.map((worksheet) => {
    const rows: RawSheet["rows"] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, line) => {
      const cells: string[] = [];

      for (let column = 1; column <= row.cellCount; column += 1) {
        cells.push(cellText(row.getCell(column).value));
      }

      rows.push({ line, cells });
    });

    return { name: worksheet.name, rows };
  });
}

function readCsv(buffer: Buffer, filename: string): RawSheet[] {
  const parsed = Papa.parse<string[]>(
    buffer.toString("utf8").replace(/^﻿/u, ""),
    { skipEmptyLines: false },
  );
  const rows = parsed.data
    .map((cells, index) => ({
      line: index + 1,
      cells: cells.map((cell) => cell.trim()),
    }))
    .filter(({ cells }) => cells.some((cell) => cell !== ""));

  return [{ name: filename, rows }];
}

/** First row (within the scan window) that names every required column. */
function findHeader<TColumn extends string>(
  sheet: RawSheet,
  layout: SpreadsheetLayout<TColumn>,
) {
  let best: { index: number; columns: Map<number, TColumn> } | null = null;

  for (const [index, row] of sheet.rows.slice(0, HEADER_SCAN_ROWS).entries()) {
    const columns = new Map<number, TColumn>();

    row.cells.forEach((cell, position) => {
      const column = layout.aliases[normalizeHeader(cell)];

      if (column && ![...columns.values()].includes(column)) {
        columns.set(position, column);
      }
    });

    if (!best || columns.size > best.columns.size) {
      best = { index, columns };
    }

    if (
      layout.required.every((column) => [...columns.values()].includes(column))
    ) {
      return { index, columns };
    }
  }

  return best;
}

function hasRequiredHeader<TColumn extends string>(
  sheet: RawSheet,
  layout: SpreadsheetLayout<TColumn>,
): boolean {
  const header = findHeader(sheet, layout);
  const matched = header ? [...header.columns.values()] : [];
  return layout.required.every((column) => matched.includes(column));
}

/**
 * Reads an .xlsx or .csv attachment into canonical rows for one import
 * layout. Headers are matched by alias (Spanish or English, accents and case
 * ignored) and may sit below a title row. Pure: no database access.
 */
export async function readSpreadsheet<TColumn extends string>(
  file: SpreadsheetFile,
  layout: SpreadsheetLayout<TColumn>,
  sheetName?: string,
): Promise<SpreadsheetReadResult<TColumn>> {
  const kind = spreadsheetKind(file);

  if (!kind) {
    return {
      ok: false,
      code: "UNSUPPORTED_SPREADSHEET_TYPE",
      message:
        "Only Excel (.xlsx) or CSV files can be imported. Ask the user to save the file as .xlsx.",
    };
  }

  const buffer = Buffer.from(file.dataBase64, "base64");

  if (buffer.byteLength > SPREADSHEET_MAX_BYTES) {
    return {
      ok: false,
      code: "CSV_FILE_TOO_LARGE",
      message: "The file exceeds 10 MB.",
    };
  }

  let sheets: RawSheet[];

  try {
    sheets =
      kind === "xlsx" ? await readXlsx(buffer) : readCsv(buffer, file.filename);
  } catch {
    return {
      ok: false,
      code: "CSV_PARSE_ERROR",
      message:
        "The file could not be read. It may be corrupted, password-protected or an old .xls.",
    };
  }

  const sheetNames = sheets.map(({ name }) => name);
  const sheet = sheetName
    ? sheets.find(
        ({ name }) =>
          name.trim().toLowerCase() === sheetName.trim().toLowerCase(),
      )
    : // A workbook may carry products and services in separate sheets: pick
      // the first one whose header fits this layout.
      (sheets.find((candidate) => hasRequiredHeader(candidate, layout)) ??
      sheets.find(({ rows }) => rows.length > 0));

  if (!sheet) {
    return {
      ok: false,
      code: "SHEET_NOT_FOUND",
      message: sheetName
        ? `No sheet named "${sheetName}".`
        : "The file has no data.",
      sheets: sheetNames,
    };
  }

  const header = findHeader(sheet, layout);
  const matched = header ? [...header.columns.values()] : [];
  const missingColumns = layout.required.filter(
    (column) => !matched.includes(column),
  );

  if (!header || missingColumns.length > 0) {
    return {
      ok: false,
      code: "CSV_MISSING_COLUMN",
      message: `Missing columns: ${missingColumns.join(", ")}. Expected headers like ${layout.expectedHeaders}.`,
      missingColumns,
      sheets: sheetNames,
    };
  }

  const dataRows = sheet.rows.slice(header.index + 1);

  if (dataRows.length > layout.maxRows) {
    return {
      ok: false,
      code: "CSV_TOO_MANY_ROWS",
      message: `The sheet has ${dataRows.length} rows; the limit is ${layout.maxRows}. Ask the user to split the file.`,
      sheets: sheetNames,
    };
  }

  const headerCells = sheet.rows[header.index]?.cells ?? [];
  const columns: Record<string, TColumn> = {};

  for (const [position, column] of header.columns) {
    columns[headerCells[position] ?? column] = column;
  }

  return {
    ok: true,
    data: {
      sheets: sheetNames,
      sheet: sheet.name,
      columns,
      rows: dataRows.map(({ line, cells }) => {
        const record: Partial<Record<TColumn, string>> = {};

        for (const [position, column] of header.columns) {
          record[column] = cells[position] ?? "";
        }

        return { line, record };
      }),
    },
  };
}

/** Prices typed as text ("$1,250.00") are common in MX spreadsheets. */
export function cleanMoneyText(value: string | undefined): string {
  return (value ?? "").replace(/[$\s,]/gu, "");
}

/** Keeps the first row of each key; later ones are reported as duplicates. */
export function dedupeRows<TRow extends { line: number }, TCode extends string>(
  rows: TRow[],
  keyOf: (row: TRow) => string,
  code: TCode,
) {
  const seen = new Set<string>();
  const unique: TRow[] = [];
  const duplicates: Array<{ line: number; code: TCode }> = [];

  for (const row of rows) {
    const key = keyOf(row);

    if (seen.has(key)) {
      duplicates.push({ line: row.line, code });
      continue;
    }

    seen.add(key);
    unique.push(row);
  }

  return { unique, duplicates };
}
