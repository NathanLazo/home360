import { parsePriceCents } from "~/app/[locale]/dashboard/products/_components/product-csv.utils";
import {
  serviceImportRowSchema,
  type ServiceImportError,
  type ServiceImportErrorCode,
  type ServiceImportRow,
} from "~/app/[locale]/dashboard/services/_components/service.schema";
import {
  cleanMoneyText,
  dedupeRows,
  readSpreadsheet,
  type SpreadsheetFailure,
  type SpreadsheetFile,
  type SpreadsheetLayout,
} from "./spreadsheet-reader";

type ServiceColumn =
  "name" | "category" | "price" | "duration" | "duration_max" | "workers";

const SERVICE_LAYOUT: SpreadsheetLayout<ServiceColumn> = {
  aliases: {
    name: "name",
    nombre: "name",
    servicio: "name",
    service: "name",
    category: "category",
    categoria: "category",
    price: "price",
    precio: "price",
    precio_base: "price",
    base_price: "price",
    precio_mxn: "price",
    duration: "duration",
    duracion: "duration",
    duracion_min: "duration",
    duracion_minutos: "duration",
    minutos: "duration",
    duration_minutes: "duration",
    duration_max: "duration_max",
    duracion_maxima: "duration_max",
    duracion_max: "duration_max",
    max_duration: "duration_max",
    workers: "workers",
    trabajadores: "workers",
    tecnicos: "workers",
    equipo: "workers",
    personal: "workers",
  },
  required: ["name", "category", "price", "duration"],
  maxRows: 500,
  expectedHeaders:
    "Servicio, Categoría, Precio, Duración (Duración máxima and Trabajadores optional)",
};

export type ServiceSpreadsheetParse = {
  sheets: string[];
  sheet: string;
  columns: Record<string, ServiceColumn>;
  totalRows: number;
  valid: ServiceImportRow[];
  /** `line` is the spreadsheet row number, as the user sees it. */
  errors: ServiceImportError[];
};

export type ServiceSpreadsheetResult =
  { ok: true; data: ServiceSpreadsheetParse } | SpreadsheetFailure;

const HOURS_PATTERN = /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hora|horas|hour|hours)$/u;
const MINUTES_PATTERN = /^(\d+)\s*(?:m|min|mins|minuto|minutos|minutes)?$/u;
const CLOCK_PATTERN = /^(\d+):([0-5]\d)$/u;

/** "90", "90 min", "1.5 h", "2 horas" or "1:30" → minutes. */
function parseDurationMinutes(value: string | undefined): number | undefined {
  const text = (value ?? "").trim().toLowerCase().replace(",", ".");

  if (text === "") {
    return undefined;
  }

  const clock = CLOCK_PATTERN.exec(text);

  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  const hours = HOURS_PATTERN.exec(text);

  if (hours) {
    return Math.round(Number(hours[1]) * 60);
  }

  const minutes = MINUTES_PATTERN.exec(text);
  return minutes ? Number(minutes[1]) : Number.NaN;
}

/** Absent column or empty cell → `undefined`: existing workers are kept. */
function splitWorkers(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value
    .split(/[,;\n]/u)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function issueCode(path: PropertyKey | undefined): ServiceImportErrorCode {
  switch (path) {
    case "category":
      return "SERVICE_INVALID_CATEGORY";
    case "basePriceCents":
      return "SERVICE_INVALID_PRICE";
    case "durationMinutes":
      return "SERVICE_INVALID_DURATION";
    case "durationMaxMinutes":
      return "SERVICE_INVALID_DURATION_MAX";
    default:
      return "SERVICE_INVALID_NAME";
  }
}

/**
 * Parses a service catalog spreadsheet into rows `service.importRows`
 * accepts. Names repeated in the file keep their first row; worker names are
 * resolved later, inside the import transaction.
 */
export async function parseServiceSpreadsheet(
  file: SpreadsheetFile,
  sheetName?: string,
): Promise<ServiceSpreadsheetResult> {
  const table = await readSpreadsheet(file, SERVICE_LAYOUT, sheetName);

  if (!table.ok) {
    return table;
  }

  const valid: ServiceImportRow[] = [];
  const errors: ServiceImportError[] = [];

  for (const { line, record } of table.data.rows) {
    const parsed = serviceImportRowSchema.safeParse({
      line,
      name: record.name,
      category: record.category,
      basePriceCents: parsePriceCents(cleanMoneyText(record.price)),
      durationMinutes: parseDurationMinutes(record.duration),
      durationMaxMinutes: parseDurationMinutes(record.duration_max),
      workerNames: splitWorkers(record.workers),
    });

    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      errors.push({ line, code: issueCode(parsed.error.issues[0]?.path[0]) });
    }
  }

  const { unique, duplicates } = dedupeRows(
    valid,
    (row) => row.name.trim().toLowerCase(),
    "DUPLICATE_NAME_IN_FILE",
  );

  return {
    ok: true,
    data: {
      sheets: table.data.sheets,
      sheet: table.data.sheet,
      columns: table.data.columns,
      totalRows: table.data.rows.length,
      valid: unique,
      errors: [...errors, ...duplicates].sort((a, b) => a.line - b.line),
    },
  };
}
