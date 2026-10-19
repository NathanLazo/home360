import type { RouterInputs, RouterOutputs } from "~/trpc/react";

type ProductOutput = RouterOutputs["product"];

export type ProductListResult = NonNullable<ProductOutput["list"]["result"]>;
export type ProductListItem = ProductListResult["items"][number];
export type ProductStockBranch = NonNullable<
  ProductOutput["listStockBranches"]["result"]
>[number];
export type ProductStockDetail = NonNullable<
  ProductOutput["getStockByBranch"]["result"]
>[number];

export type ProductFiltersState = {
  search: string;
  category: string;
  status: "" | ProductListItem["status"];
  lowStockOnly: boolean;
};

export type ProductStockFormValue = {
  branchId: string;
  branchName: string;
  branchStatus: ProductStockBranch["status"];
  isCarried: boolean;
  stock: string;
  lowStockThreshold: string;
  /**
   * Stock the editor loaded for a carried branch: sent back as
   * `expectedStock` so a sale or another edit in between answers CONFLICT
   * instead of being overwritten (D10-4). Absent for new rows.
   */
  expectedStock?: number;
};

/** `product.adjustStock` input, rows with the optional `expectedStock`. */
export type ProductStockAdjustRequest = RouterInputs["product"]["adjustStock"];

export type ProductFormValues = {
  name: string;
  sku: string;
  category: string;
  price: string;
  imageUrl: string;
  published: boolean;
  stocks: ProductStockFormValue[];
};

export type ProductFormErrors = Partial<
  Record<"name" | "sku" | "category" | "price" | "imageUrl" | "stocks", string>
> & { stockRows?: Record<string, string> };

export type ProductMutationResult = {
  ok: boolean;
  error: string | null;
};
