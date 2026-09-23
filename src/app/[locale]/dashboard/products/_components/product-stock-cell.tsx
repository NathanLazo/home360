import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ProductListItem } from "./product.types";

export function ProductStockCell({
  product,
  branchSelected,
}: {
  product: ProductListItem;
  branchSelected: boolean;
}) {
  const t = useTranslations("dashboard.products.stock");

  if (!product.isCarried) {
    return (
      <span className="text-muted-foreground text-copy-sm">
        {t(branchSelected ? "notAvailableHere" : "notCarried")}
      </span>
    );
  }

  const lowStockLabel = branchSelected
    ? t("lowStock")
    : t("lowAcrossBranches", {
        low: product.branchesWithLowStock,
        total: product.branchesCarrying,
      });

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-mono font-semibold tabular-nums">
        {product.stock}
      </span>
      {product.isLowStock ? (
        <span
          className="text-warning-deep flex items-center gap-1 text-xs font-medium"
          title={lowStockLabel}
        >
          <CircleAlertIcon aria-hidden="true" className="size-3.5" />
          {lowStockLabel}
        </span>
      ) : null}
    </div>
  );
}
