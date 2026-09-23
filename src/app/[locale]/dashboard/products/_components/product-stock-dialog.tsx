"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  LoaderCircleIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ProductStockFields } from "./product-stock-fields";
import { parseStockRows, toStockFormValues } from "./product-stock.utils";
import type {
  ProductFormErrors,
  ProductListItem,
  ProductMutationResult,
  ProductStockFormValue,
} from "./product.types";
import type { ProductAdjustStockInput } from "./product.schema";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";

/** Row action "Ajustar stock": edits per-branch stock without the full form. */
export function ProductStockDialog({
  product,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  product: ProductListItem | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ProductAdjustStockInput) => Promise<ProductMutationResult>;
}) {
  const t = useTranslations("dashboard.products.stockDialog");
  const formT = useTranslations("dashboard.products.form");
  const errorsT = useTranslations("errors");
  const open = product !== null;
  useCloseWhenReadOnly(open, onOpenChange);
  const [rows, setRows] = useState<ProductStockFormValue[] | null>(null);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const shakeInvalid = useErrorShake();
  const stockQuery = api.product.getStockByBranch.useQuery(
    { productId: product?.id ?? "" },
    { enabled: open },
  );
  const responseError = stockQuery.data?.error ?? null;
  const loadFailed = Boolean(stockQuery.error ?? responseError);

  useEffect(() => {
    if (!open) {
      setRows(null);
      setErrors({});
      return;
    }
    if (rows !== null || stockQuery.isFetching || !stockQuery.data?.result) {
      return;
    }
    setRows(toStockFormValues(stockQuery.data.result));
  }, [open, rows, stockQuery.data?.result, stockQuery.isFetching]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product || !rows) return;
    const formElement = event.currentTarget;
    const { stocks, invalidBranchIds } = parseStockRows(rows);

    if (invalidBranchIds.length > 0) {
      setErrors({
        stockRows: Object.fromEntries(
          invalidBranchIds.map((branchId) => [
            branchId,
            formT("stock.invalidRow"),
          ]),
        ),
      });
      shakeInvalid(formElement);
      window.requestAnimationFrame(() =>
        document
          .getElementById(`product-stock-${invalidBranchIds[0]}`)
          ?.focus(),
      );
      return;
    }

    setErrors({});
    const result = await onSubmit({ id: product.id, stocks });
    if (result.ok) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,48rem)] flex-col overflow-hidden p-0 sm:max-w-xl"
        aria-busy={submitting || rows === null}
      >
        <DialogHeader className="border-b px-6 py-5 pr-16">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: product?.name ?? "" })}
          </DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={formT("close")}
              disabled={submitting}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>

        {loadFailed ? (
          <div
            className="flex flex-col items-center gap-3 px-6 py-10 text-center"
            role="alert"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="text-destructive"
            />
            <p className="font-medium">{formT("stock.loadErrorTitle")}</p>
            <p className="text-muted-foreground text-copy-sm">
              {responseError
                ? errorsT(responseError)
                : formT("stock.loadErrorDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void stockQuery.refetch()}
            >
              <RotateCcwIcon aria-hidden="true" />
              {formT("retry")}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-5">
              {rows === null ? (
                <div className="flex h-40 items-center justify-center">
                  <LoaderCircleIcon
                    className="animate-spin motion-reduce:animate-none"
                    aria-label={formT("loading")}
                  />
                </div>
              ) : (
                <ProductStockFields
                  stocks={rows}
                  errors={errors}
                  disabled={submitting}
                  onChange={setRows}
                />
              )}
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                >
                  {formT("cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                metal="live"
                disabled={submitting || rows === null || rows.length === 0}
              >
                {submitting ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
