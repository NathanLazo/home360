import ExcelJS from "exceljs";
import Papa from "papaparse";

import { mapParsedRows } from "~/app/[locale]/dashboard/products/_components/product-csv.utils";
import type {
  CsvRowError,
  ProductCsvRow,
} from "~/app/[locale]/dashboard/products/_components/product.schema";

/** Larger than the dashboard CSV cap: the agent chunks the write (500/call). */
export const INVENTORY_SHEET_MAX_ROWS = 2_000;
export const INVENTORY_SHEET_MAX_BYTES = 10 * 1024 * 1024;

/** How far down the sheet the header row is searched (titles, logos…). */
const HEADER_SCAN_ROWS = 10;

const XLSX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const INVENTORY_SPREADSHEET_MEDIA_TYPES = [
  XLSX_MEDIA_TYPE,
  "text/csv",
] as const;

type InventoryColumn =
  "name" | "sku" | "category" | "price" | "stock" | "low_stock_threshold";

const REQUIRED_COLUMNS: readonly InventoryColumn[] = [
  "name",
  "sku",
  "category",
  "price",
  "stock",
];

/** Normalized header (lowercase, no accents, `_`) → canonical column. */
const COLUMN_ALIASES: Record<string, InventoryColumn> = {
  name: "name",
  nombre: "name",
  producto: "name",
  product: "name",
  descripcion: "name",
  sku: "sku",
  codigo: "sku",
  clave: "sku",
  code: "sku",
  category: "category",
  categoria: "category",
  price: "price",
  precio: "price",
  precio_mxn: "price",
  price_mxn: "price",
  stock: "stock",
  existencias: "stock",
  existencia: "stock",
  cantidad: "stock",
  inventario: "stock",
  quantity: "stock",
  qty: "stock",
  low_stock_threshold: "low_stock_threshold",
  minimo: "low_stock_threshold",
  stock_minimo: "low_stock_threshold",
  min_stock: "low_stock_threshold",
};

export type InventorySpreadsheetFile = {
  filename: string;
  mediaType: string;
  dataBase64: string;
};

export type InventorySpreadsheetErrorCode =
  | "UNSUPPORTED_SPREADSHEET_TYPE"
  | "CSV_FILE_TOO_LARGE"
  | "CSV_PARSE_ERROR"
  | "SHEET_NOT_FOUND"
  | "CSV_MISSING_COLUMN"
  | "CSV_TOO_MANY_ROWS";

export type InventorySpreadsheetParse = {
  sheets: string[];
  sheet: string;
  /** Spreadsheet header text → canonical column it was matched to. */
  columns: Record<string, InventoryColumn>;
  totalRows: number;
  valid: ProductCsvRow[];
  /** `line` is the spreadsheet row number, as the user sees it. */
  errors: CsvRowError[];
};

export type InventorySpreadsheetResult =
  | { ok: true; data: InventorySpreadsheetParse }
  | {
      ok: false;
      code: InventorySpreadsheetErrorCode;
      message: string;
      missingColumns?: InventoryColumn[];
      sheets?: string[];
    };

type SheetTable = {
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

function isSpreadsheetKind(
  file: InventorySpreadsheetFile,
): "xlsx" | "csv" | null {
  const extension = file.filename.toLowerCase().split(".").pop();

  if (file.mediaType === XLSX_MEDIA_TYPE || extension === "xlsx") {
    return "xlsx";
  }

  if (file.mediaType === "text/csv" || extension === "csv") {
    return "csv";
  }

  return null;
}

/** Excel cell → text the CSV mapper understands (`125.5`, `10`, `Tubo`). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    // Float noise from Excel (125.49999…) never reaches the price parser.
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

async function readXlsx(buffer: Buffer): Promise<SheetTable[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs types its input as an ArrayBuffer; copy out of Node's pooled Buffer.
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  await workbook.xlsx.load(arrayBuffer);

  return workbook.worksheets.map((worksheet) => {
    const rows: SheetTable["rows"] = [];

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

function readCsv(buffer: Buffer, filename: string): SheetTable[] {
  const parsed = Papa.parse<string[]>(
    buffer.toString("utf8").replace(/^﻿/u, ""),
    {
      skipEmptyLines: false,
    },
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
function findHeader(table: SheetTable) {
  let best: { index: number; columns: Map<number, InventoryColumn> } | null =
    null;

  for (const [index, row] of table.rows.slice(0, HEADER_SCAN_ROWS).entries()) {
    const columns = new Map<number, InventoryColumn>();

    row.cells.forEach((cell, position) => {
      const column = COLUMN_ALIASES[normalizeHeader(cell)];

      if (column && ![...columns.values()].includes(column)) {
        columns.set(position, column);
      }
    });

    if (!best || columns.size > best.columns.size) {
      best = { index, columns };
    }

    if (
      REQUIRED_COLUMNS.every((column) => [...columns.values()].includes(column))
    ) {
      return { index, columns };
    }
  }

  return best;
}

/** Keeps the first occurrence of each SKU; later ones become row errors. */
function dedupeBySku(rows: ProductCsvRow[]) {
  const seen = new Set<string>();
  const unique: ProductCsvRow[] = [];
  const duplicates: CsvRowError[] = [];

  for (const row of rows) {
    if (seen.has(row.sku)) {
      duplicates.push({ line: row.line, code: "DUPLICATE_SKU_IN_FILE" });
      continue;
    }

    seen.add(row.sku);
    unique.push(row);
  }

  return { unique, duplicates };
}

/**
 * Parses an inventory spreadsheet (.xlsx or .csv) attached in the agent chat
 * into validated product rows. Headers are matched in Spanish or English and
 * may sit below a title row; validation reuses the dashboard CSV mapper so
 * both import paths accept exactly the same data. Pure: no database access.
 */
export async function parseInventorySpreadsheet(
  file: InventorySpreadsheetFile,
  sheetName?: string,
): Promise<InventorySpreadsheetResult> {
  const kind = isSpreadsheetKind(file);

  if (!kind) {
    return {
      ok: false,
      code: "UNSUPPORTED_SPREADSHEET_TYPE",
      message:
        "Only Excel (.xlsx) or CSV files can be imported. Ask the user to save the file as .xlsx.",
    };
  }

  const buffer = Buffer.from(file.dataBase64, "base64");

  if (buffer.byteLength > INVENTORY_SHEET_MAX_BYTES) {
    return {
      ok: false,
      code: "CSV_FILE_TOO_LARGE",
      message: "The file exceeds 10 MB.",
    };
  }

  let tables: SheetTable[];

  try {
    tables =
      kind === "xlsx" ? await readXlsx(buffer) : readCsv(buffer, file.filename);
  } catch {
    return {
      ok: false,
      code: "CSV_PARSE_ERROR",
      message:
        "The file could not be read. It may be corrupted, password-protected or an old .xls.",
    };
  }

  const sheets = tables.map(({ name }) => name);
  const table = sheetName
    ? tables.find(
        ({ name }) =>
          name.trim().toLowerCase() === sheetName.trim().toLowerCase(),
      )
    : tables.find(({ rows }) => rows.length > 0);

  if (!table) {
    return {
      ok: false,
      code: "SHEET_NOT_FOUND",
      message: sheetName
        ? `No sheet named "${sheetName}".`
        : "The file has no data.",
      sheets,
    };
  }

  const header = findHeader(table);
  const matched = header ? [...header.columns.values()] : [];
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !matched.includes(column),
  );

  if (!header || missingColumns.length > 0) {
    return {
      ok: false,
      code: "CSV_MISSING_COLUMN",
      message: `Missing columns: ${missingColumns.join(", ")}. Expected headers like Nombre, SKU, Categoría, Precio, Stock (Mínimo optional).`,
      missingColumns,
      sheets,
    };
  }

  const dataRows = table.rows.slice(header.index + 1);

  if (dataRows.length > INVENTORY_SHEET_MAX_ROWS) {
    return {
      ok: false,
      code: "CSV_TOO_MANY_ROWS",
      message: `The sheet has ${dataRows.length} rows; the limit is ${INVENTORY_SHEET_MAX_ROWS}. Ask the user to split the file.`,
      sheets,
    };
  }

  const headerRow = table.rows[header.index];
  const columns: Record<string, InventoryColumn> = {};

  for (const [position, column] of header.columns) {
    columns[headerRow?.cells[position] ?? column] = column;
  }

  const mapped = mapParsedRows(
    dataRows.map(({ line, cells }) => {
      const record: Record<string, string> = {};

      for (const [position, column] of header.columns) {
        const cell = cells[position] ?? "";
        // Prices typed as text ("$1,250.00") are common in MX spreadsheets.
        record[column] =
          column === "price" ? cell.replace(/[$\s,]/gu, "") : cell;
      }

      return { line, record };
    }),
  );
  const { unique, duplicates } = dedupeBySku(mapped.valid);

  return {
    ok: true,
    data: {
      sheets,
      sheet: table.name,
      columns,
      totalRows: dataRows.length,
      valid: unique,
      errors: [...mapped.errors, ...duplicates].sort((a, b) => a.line - b.line),
    },
  };
}
