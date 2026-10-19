import type { ProductCreateInput } from "./product.schema";
import type {
  ProductStockAdjustRequest,
  ProductStockDetail,
  ProductStockFormValue,
} from "./product.types";

export function nonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function toStockFormValues(
  details: ProductStockDetail[],
): ProductStockFormValue[] {
  return details.map((stock) => ({
    branchId: stock.branchId,
    branchName: stock.branchName,
    branchStatus: stock.branchStatus,
    isCarried: stock.isCarried,
    stock: String(stock.stock),
    lowStockThreshold: String(stock.lowStockThreshold),
    ...(stock.isCarried ? { expectedStock: stock.stock } : {}),
  }));
}

export type StockLevel = "out" | "low" | "ok";

/**
 * Live state of a stock row while editing (same rule as the server's
 * `isLowStock`: at or under the threshold is low; zero is out of stock).
 * `null` while the inputs are not valid numbers.
 */
export function stockLevel(row: ProductStockFormValue): StockLevel | null {
  const stock = nonNegativeInteger(row.stock);
  const threshold = nonNegativeInteger(row.lowStockThreshold);
  if (stock === null || threshold === null) return null;
  if (stock === 0) return "out";
  return stock <= threshold ? "low" : "ok";
}

/**
 * Rows for `product.adjustStock`: every row that was carried when the editor
 * loaded carries the stock it showed as `expectedStock` (compare-and-set,
 * D10-4). `null` when some row has invalid numbers (see `parseStockRows`).
 */
export function toStockAdjustRows(
  rows: ProductStockFormValue[],
): ProductStockAdjustRequest["stocks"] | null {
  const { stocks, invalidBranchIds } = parseStockRows(rows);
  if (invalidBranchIds.length > 0) return null;
  const loaded = new Map(
    rows.map((row) => [row.branchId, row.expectedStock] as const),
  );

  return stocks.map((stock) => {
    const expectedStock = loaded.get(stock.branchId);
    return expectedStock === undefined ? stock : { ...stock, expectedStock };
  });
}

/**
 * Parses the carried rows of the per-branch stock editor. Rows with invalid
 * numbers are reported by branch id so the UI can flag them inline.
 */
export function parseStockRows(rows: ProductStockFormValue[]): {
  stocks: ProductCreateInput["stocks"];
  invalidBranchIds: string[];
} {
  const stocks: ProductCreateInput["stocks"] = [];
  const invalidBranchIds: string[] = [];

  for (const row of rows.filter((stock) => stock.isCarried)) {
    const stock = nonNegativeInteger(row.stock);
    const threshold = nonNegativeInteger(row.lowStockThreshold);
    if (stock === null || threshold === null) {
      invalidBranchIds.push(row.branchId);
    } else {
      stocks.push({
        branchId: row.branchId,
        stock,
        lowStockThreshold: threshold,
      });
    }
  }

  return { stocks, invalidBranchIds };
}
