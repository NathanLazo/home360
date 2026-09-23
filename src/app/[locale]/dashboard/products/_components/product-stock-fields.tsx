"use client";

import { useTranslations } from "next-intl";

import type { ProductFormErrors, ProductStockFormValue } from "./product.types";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

export function ProductStockFields({
  stocks,
  errors,
  disabled,
  onChange,
}: {
  stocks: ProductStockFormValue[];
  errors: ProductFormErrors;
  disabled: boolean;
  onChange: (stocks: ProductStockFormValue[]) => void;
}) {
  const t = useTranslations("dashboard.products.form.stock");
  const multiple = stocks.length > 1;

  function update(branchId: string, patch: Partial<ProductStockFormValue>) {
    onChange(
      stocks.map((stock) =>
        stock.branchId === branchId ? { ...stock, ...patch } : stock,
      ),
    );
  }

  return (
    <fieldset className="flex flex-col gap-3 px-4">
      <legend className="mb-1 font-medium">{t("title")}</legend>
      <p className="text-muted-foreground -mt-2 text-sm">{t("description")}</p>
      {errors.stocks ? (
        <p role="alert" className="text-error-deep text-copy-sm">
          {errors.stocks}
        </p>
      ) : null}
      {stocks.length === 0 ? (
        <p className="text-muted-foreground text-copy-sm rounded-md border border-dashed p-4">
          {t("noBranches")}
        </p>
      ) : null}
      {stocks.map((stock) => {
        const rowError = errors.stockRows?.[stock.branchId];
        const carriedId = `product-carried-${stock.branchId}`;
        const stockId = `product-stock-${stock.branchId}`;
        const thresholdId = `product-threshold-${stock.branchId}`;

        return (
          <div
            key={stock.branchId}
            className={cn(
              "flex flex-col gap-4",
              multiple && "rounded-md border p-4",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor={carriedId} className="truncate">
                  {stock.branchName}
                </Label>
                {stock.branchStatus === "PAUSED" ? (
                  <p className="text-muted-foreground text-xs">
                    {t("pausedBranch")}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-copy-sm">
                  {t("carriedHere")}
                </span>
                <Switch
                  id={carriedId}
                  checked={stock.isCarried}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    update(stock.branchId, { isCarried: checked })
                  }
                />
              </div>
            </div>
            {stock.isCarried ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={stockId}>{t("stockLabel")}</Label>
                  <Input
                    id={stockId}
                    name={`stock-${stock.branchId}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stock.stock}
                    disabled={disabled}
                    aria-invalid={Boolean(rowError)}
                    aria-describedby={rowError ? `${stockId}-error` : undefined}
                    onChange={(event) =>
                      update(stock.branchId, { stock: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={thresholdId}>{t("thresholdLabel")}</Label>
                  <Input
                    id={thresholdId}
                    name={`threshold-${stock.branchId}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stock.lowStockThreshold}
                    disabled={disabled}
                    aria-invalid={Boolean(rowError)}
                    aria-describedby={rowError ? `${stockId}-error` : undefined}
                    onChange={(event) =>
                      update(stock.branchId, {
                        lowStockThreshold: event.target.value,
                      })
                    }
                  />
                </div>
                {rowError ? (
                  <p
                    id={`${stockId}-error`}
                    role="alert"
                    className="text-error-deep text-copy-sm sm:col-span-2"
                  >
                    {rowError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-copy-sm">
                {t("notCarried")}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
