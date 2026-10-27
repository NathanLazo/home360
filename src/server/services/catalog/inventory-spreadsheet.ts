import { mapParsedRows } from "~/app/[locale]/dashboard/products/_components/product-csv.utils";
import type {
  CsvRowError,
  ProductCsvRow,
} from "~/app/[locale]/dashboard/products/_components/product.schema";
import {
  cleanMoneyText,
  dedupeRows,
  readSpreadsheet,
  type SpreadsheetFailure,
  type SpreadsheetFile,
  type SpreadsheetLayout,
} from "./spreadsheet-reader";

type InventoryColumn =
  "name" | "sku" | "category" | "price" | "stock" | "low_stock_threshold";

/** Larger than the dashboard CSV cap: the agent chunks the write (500/call). */
const INVENTORY_LAYOUT: SpreadsheetLayout<InventoryColumn> = {
  aliases: {
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
  },
  required: ["name", "sku", "category", "price", "stock"],
  maxRows: 2_000,
  expectedHeaders: "Nombre, SKU, Categoría, Precio, Stock (Mínimo optional)",
};

export type InventorySpreadsheetParse = {
  sheets: string[];
  sheet: string;
  columns: Record<string, InventoryColumn>;
  totalRows: number;
  valid: ProductCsvRow[];
  /** `line` is the spreadsheet row number, as the user sees it. */
  errors: CsvRowError[];
};

export type InventorySpreadsheetResult =
  { ok: true; data: InventorySpreadsheetParse } | SpreadsheetFailure;

/**
 * Parses a product inventory spreadsheet into validated rows. Validation
 * reuses the dashboard CSV mapper so both import paths accept exactly the
 * same data; SKUs repeated in the file keep their first row.
 */
export async function parseInventorySpreadsheet(
  file: SpreadsheetFile,
  sheetName?: string,
): Promise<InventorySpreadsheetResult> {
  const table = await readSpreadsheet(file, INVENTORY_LAYOUT, sheetName);

  if (!table.ok) {
    return table;
  }

  const mapped = mapParsedRows(
    table.data.rows.map(({ line, record }) => ({
      line,
      record: { ...record, price: cleanMoneyText(record.price) },
    })),
  );
  const { unique, duplicates } = dedupeRows(
    mapped.valid,
    (row) => row.sku,
    "DUPLICATE_SKU_IN_FILE",
  );

  return {
    ok: true,
    data: {
      sheets: table.data.sheets,
      sheet: table.data.sheet,
      columns: table.data.columns,
      totalRows: table.data.rows.length,
      valid: unique,
      errors: [...mapped.errors, ...duplicates].sort((a, b) => a.line - b.line),
    },
  };
}
