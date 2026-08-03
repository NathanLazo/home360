import Papa from "papaparse";

import {
  productCsvRowSchema,
  type CsvRowError,
  type CsvRowErrorCode,
  type ProductCsvRow,
} from "./product.schema";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_CSV_ROWS = 500;
const REQUIRED_HEADERS = ["name", "sku", "category", "price", "stock"] as const;

type ParsedCsvRecord = {
  line: number;
  record: Record<string, unknown>;
};

export type ProductsCsvParseResult = {
  valid: ProductCsvRow[];
  errors: CsvRowError[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNonNegativeInteger(value: unknown, defaultValue?: number) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized === "" && defaultValue !== undefined) {
    return defaultValue;
  }

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function parsePriceCents(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    return Number.NaN;
  }

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;

  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

function issueCode(path: PropertyKey | undefined): CsvRowErrorCode {
  switch (path) {
    case "name":
      return "CSV_INVALID_NAME";
    case "sku":
      return "CSV_INVALID_SKU";
    case "category":
      return "CSV_INVALID_CATEGORY";
    case "priceCents":
      return "CSV_INVALID_PRICE";
    case "stock":
      return "CSV_INVALID_STOCK";
    case "lowStockThreshold":
      return "CSV_INVALID_LOW_STOCK_THRESHOLD";
    default:
      return "CSV_PARSE_ERROR";
  }
}

export function mapParsedRows(rows: unknown[]): ProductsCsvParseResult {
  const valid: ProductCsvRow[] = [];
  const errors: CsvRowError[] = [];

  for (const row of rows) {
    if (
      !isRecord(row) ||
      !Number.isInteger(row.line) ||
      Number(row.line) < 1 ||
      !isRecord(row.record)
    ) {
      errors.push({ line: 1, code: "CSV_PARSE_ERROR" });
      continue;
    }

    const line = Number(row.line);
    const candidate = {
      line,
      name: row.record.name,
      sku: row.record.sku,
      category: row.record.category,
      priceCents: parsePriceCents(row.record.price),
      stock: parseNonNegativeInteger(row.record.stock),
      lowStockThreshold: parseNonNegativeInteger(
        row.record.low_stock_threshold,
        5,
      ),
    };
    const parsed = productCsvRowSchema.safeParse(candidate);

    if (parsed.success) {
      valid.push(parsed.data);
      continue;
    }

    errors.push({
      line,
      code: issueCode(parsed.error.issues[0]?.path[0]),
    });
  }

  return { valid, errors };
}

function physicalLineAtOffset(source: string, offset: number) {
  let line = 1;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
    } else if (source[index] === "\r" && source[index + 1] !== "\n") {
      line += 1;
    }
  }

  return line;
}

function firstContentOffset(source: string, start: number, end: number) {
  let offset = start;

  while (offset < end) {
    let boundary = end;

    for (let index = offset; index < end; index += 1) {
      if (source[index] === "\n") {
        boundary = index + 1;
        break;
      }

      if (source[index] === "\r") {
        boundary = source[index + 1] === "\n" ? index + 2 : index + 1;
        break;
      }
    }

    const physicalLine = source.slice(offset, boundary).replace(/[\r\n]+$/, "");

    if (physicalLine.trim() !== "") {
      return offset;
    }

    offset = boundary;
  }

  return start;
}

export async function parseProductsCsv(
  file: File,
): Promise<ProductsCsvParseResult> {
  if (file.size > MAX_CSV_BYTES) {
    return {
      valid: [],
      errors: [{ line: 1, code: "CSV_FILE_TOO_LARGE" }],
    };
  }

  const source = await file.text();
  const parsedRows: ParsedCsvRecord[] = [];
  const parserErrors: CsvRowError[] = [];
  const headerResult = Papa.parse<string[]>(source, { preview: 1 });
  const headers = headerResult.data[0] ?? [];
  const headerCursor = headerResult.meta.cursor;
  let previousCursor = headerCursor;
  let dataRowCount = 0;
  let hasTooManyRows = false;

  const missingHeader = REQUIRED_HEADERS.some(
    (header) => !headers.includes(header),
  );

  if (missingHeader) {
    return {
      valid: [],
      errors: [{ line: 1, code: "CSV_MISSING_COLUMN" }],
    };
  }

  Papa.parse<Record<string, unknown>>(source, {
    header: true,
    skipEmptyLines: true,
    step(result, parser) {
      const rowStart = firstContentOffset(
        source,
        previousCursor,
        result.meta.cursor,
      );
      const line = physicalLineAtOffset(source, rowStart);
      previousCursor = result.meta.cursor;
      dataRowCount += 1;

      if (dataRowCount > MAX_CSV_ROWS) {
        hasTooManyRows = true;
        parser.abort();
        return;
      }

      if (result.errors.length > 0) {
        parserErrors.push({ line, code: "CSV_PARSE_ERROR" });
        return;
      }

      parsedRows.push({ line, record: result.data });
    },
  });

  if (hasTooManyRows) {
    return {
      valid: [],
      errors: [{ line: 1, code: "CSV_TOO_MANY_ROWS" }],
    };
  }

  const mapped = mapParsedRows(parsedRows);
  return { valid: mapped.valid, errors: [...parserErrors, ...mapped.errors] };
}
