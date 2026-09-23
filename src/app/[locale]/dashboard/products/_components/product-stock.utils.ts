import type { ProductCreateInput } from "./product.schema";
import type {
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
  }));
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
