"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LoaderCircleIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ProductFormFields } from "./product-form-fields";
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "./product.schema";
import type {
  ProductFormErrors,
  ProductFormValues,
  ProductListItem,
  ProductMutationResult,
  ProductStockBranch,
} from "./product.types";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { api } from "~/trpc/react";

function pesosToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "", fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function nonNegativeInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function emptyValues(branches: ProductStockBranch[]): ProductFormValues {
  return {
    name: "",
    sku: "",
    category: "",
    price: "",
    published: false,
    stocks: branches.map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      branchStatus: branch.status,
      isCarried: false,
      stock: "0",
      lowStockThreshold: "5",
    })),
  };
}

export function ProductFormSheet({
  open,
  product,
  branches,
  categories,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  product: ProductListItem | null;
  branches: ProductStockBranch[];
  categories: string[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ProductCreateInput) => Promise<ProductMutationResult>;
  onUpdate: (
    input: ProductUpdateInput,
    desiredStatus: ProductListItem["status"],
    currentStatus: ProductListItem["status"],
  ) => Promise<ProductMutationResult>;
}) {
  const t = useTranslations("dashboard.products.form");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const errorsT = useTranslations("errors");
  const [values, setValues] = useState<ProductFormValues>(() =>
    emptyValues(branches),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const initializedFor = useRef<string | null>(null);
  const stockQuery = api.product.getStockByBranch.useQuery(
    { productId: product?.id ?? "" },
    { enabled: open && product !== null },
  );
  const stockResponseError = stockQuery.data?.error ?? null;

  useEffect(() => {
    if (!open) {
      initializedFor.current = null;
      return;
    }
    const key = product?.id ?? "create";
    if (initializedFor.current === key) return;
    if (!product) {
      setErrors({});
      setValues(emptyValues(branches));
      initializedFor.current = key;
      return;
    }
    if (stockQuery.isFetching || !stockQuery.data?.result) return;
    setErrors({});
    setValues({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: `${Math.floor(product.priceCents / 100)}.${String(product.priceCents % 100).padStart(2, "0")}`,
      published: product.status === "PUBLISHED",
      stocks: stockQuery.data.result.map((stock) => ({
        branchId: stock.branchId,
        branchName: stock.branchName,
        branchStatus: stock.branchStatus,
        isCarried: stock.isCarried,
        stock: String(stock.stock),
        lowStockThreshold: String(stock.lowStockThreshold),
      })),
    });
    initializedFor.current = key;
    window.requestAnimationFrame(() =>
      document.getElementById("product-name")?.focus(),
    );
  }, [branches, open, product, stockQuery.data?.result, stockQuery.isFetching]);

  function focus(id: string) {
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function showSchemaErrors(issues: ReadonlyArray<{ path: PropertyKey[] }>) {
    const next: ProductFormErrors = { stockRows: {} };
    let firstId: string | null = null;
    for (const issue of issues) {
      const field = issue.path[0];
      if (field === "priceCents") {
        next.price = t("invalidField");
        firstId ??= "product-price";
      } else if (field === "name" || field === "sku" || field === "category") {
        next[field] = t("invalidField");
        firstId ??= `product-${field}`;
      } else if (field === "stocks") {
        const index = typeof issue.path[1] === "number" ? issue.path[1] : -1;
        const row = values.stocks.filter((stock) => stock.isCarried)[index];
        if (row) {
          next.stockRows![row.branchId] = t("stock.invalidRow");
          firstId ??= `product-stock-${row.branchId}`;
        } else next.stocks = t("stock.invalidRow");
      }
    }
    setErrors(next);
    if (firstId) focus(firstId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: ProductFormErrors = { stockRows: {} };
    const priceCents = pesosToCents(values.price);
    if (priceCents === null) nextErrors.price = t("invalidField");

    const stocks: ProductCreateInput["stocks"] = [];
    for (const row of values.stocks.filter((stock) => stock.isCarried)) {
      const stock = nonNegativeInteger(row.stock);
      const threshold = nonNegativeInteger(row.lowStockThreshold);
      if (stock === null || threshold === null) {
        nextErrors.stockRows![row.branchId] = t("stock.invalidRow");
      } else {
        stocks.push({
          branchId: row.branchId,
          stock,
          lowStockThreshold: threshold,
        });
      }
    }
    if (nextErrors.price || Object.keys(nextErrors.stockRows!).length > 0) {
      setErrors(nextErrors);
      const firstStockId = Object.keys(nextErrors.stockRows!)[0];
      focus(
        nextErrors.price ? "product-price" : `product-stock-${firstStockId}`,
      );
      return;
    }

    const common = {
      name: values.name,
      sku: values.sku,
      category: values.category,
      priceCents: priceCents!,
      stocks,
    };
    const parsed = product
      ? productUpdateSchema.safeParse({ id: product.id, ...common })
      : productCreateSchema.safeParse({
          ...common,
          status: values.published ? "PUBLISHED" : "DRAFT",
        });
    if (!parsed.success) {
      showSchemaErrors(parsed.error.issues);
      return;
    }

    setErrors({});
    savingRef.current = true;
    setSaving(true);
    let result: ProductMutationResult;
    try {
      result = await (product
        ? onUpdate(
            parsed.data as ProductUpdateInput,
            values.published ? "PUBLISHED" : "DRAFT",
            product.status,
          )
        : onCreate(parsed.data as ProductCreateInput));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (result.ok) onOpenChange(false);
    else if (result.error === "SKU_TAKEN") {
      setErrors({ sku: t("skuTaken") });
      focus("product-sku");
    }
  }

  const detailLoading =
    product !== null && initializedFor.current !== product.id;
  const detailError =
    product !== null && Boolean(stockQuery.error ?? stockResponseError);
  const busy = submitting || saving;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!submitting && !savingRef.current) onOpenChange(next);
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focus("product-name");
        }}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{t(product ? "editTitle" : "createTitle")}</SheetTitle>
          <SheetDescription>
            {t(product ? "editDescription" : "createDescription")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 min-h-11 min-w-11"
              aria-label={t("close")}
              disabled={busy}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        {detailError ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
            role="alert"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="text-destructive"
            />
            <p className="font-medium">{t("stock.loadErrorTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {stockResponseError
                ? errorsT(stockResponseError)
                : t("stock.loadErrorDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void stockQuery.refetch()}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
            aria-busy={busy || detailLoading}
          >
            <div className="min-h-0 flex-1 overflow-y-auto py-4">
              {detailLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <LoaderCircleIcon
                    className="animate-spin motion-reduce:animate-none"
                    aria-label={t("loading")}
                  />
                </div>
              ) : (
                <ProductFormFields
                  values={values}
                  errors={errors}
                  categories={categories}
                  disabled={busy}
                  onChange={setValues}
                />
              )}
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="min-h-11"
                >
                  {t("cancel")}
                </Button>
              </SheetClose>
              <Button
                type="submit"
                disabled={busy || detailLoading}
                className="min-h-11"
              >
                {busy ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t(product ? "save" : "create")}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
