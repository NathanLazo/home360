"use client";

import { useTranslations } from "next-intl";

import { ProductImageField } from "./product-image-field";
import { ProductStockFields } from "./product-stock-fields";
import type { ProductFormErrors, ProductFormValues } from "./product.types";
import { FormSection, FormSectionDivider } from "~/components/form-section";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function ProductFormFields({
  values,
  errors,
  categories,
  disabled,
  onChange,
}: {
  values: ProductFormValues;
  errors: ProductFormErrors;
  categories: string[];
  disabled: boolean;
  onChange: (values: ProductFormValues) => void;
}) {
  const t = useTranslations("dashboard.products.form");
  const set = <TKey extends keyof ProductFormValues>(
    field: TKey,
    value: ProductFormValues[TKey],
  ) => onChange({ ...values, [field]: value });

  return (
    <div className="flex flex-col gap-6">
      <FormSection
        title={t("sections.basics")}
        description={t("sections.basicsDescription")}
      >
        <Field
          label={t("nameLabel")}
          error={errors.name}
          htmlFor="product-name"
        >
          <Input
            id="product-name"
            name="name"
            value={values.name}
            disabled={disabled}
            placeholder={t("namePlaceholder")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "product-name-error" : undefined}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("skuLabel")} error={errors.sku} htmlFor="product-sku">
            <Input
              id="product-sku"
              name="sku"
              value={values.sku}
              disabled={disabled}
              placeholder={t("skuPlaceholder")}
              className="font-mono"
              autoCapitalize="characters"
              aria-invalid={Boolean(errors.sku)}
              aria-describedby={errors.sku ? "product-sku-error" : undefined}
              onChange={(event) => set("sku", event.target.value)}
            />
          </Field>
          <Field
            label={t("priceLabel")}
            error={errors.price}
            htmlFor="product-price"
          >
            <div className="relative">
              <span
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              >
                $
              </span>
              <Input
                id="product-price"
                name="price"
                type="text"
                inputMode="decimal"
                value={values.price}
                disabled={disabled}
                placeholder={t("pricePlaceholder")}
                className="pl-7 font-mono tabular-nums"
                aria-invalid={Boolean(errors.price)}
                aria-describedby={
                  errors.price ? "product-price-error" : undefined
                }
                onChange={(event) => set("price", event.target.value)}
              />
            </div>
          </Field>
        </div>
        <Field
          label={t("categoryLabel")}
          error={errors.category}
          htmlFor="product-category"
        >
          <Input
            id="product-category"
            name="category"
            list="product-category-suggestions"
            value={values.category}
            disabled={disabled}
            placeholder={t("categoryPlaceholder")}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={
              errors.category ? "product-category-error" : undefined
            }
            onChange={(event) => set("category", event.target.value)}
          />
          <datalist id="product-category-suggestions">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
      </FormSection>

      <FormSectionDivider />

      <FormSection
        title={t("sections.media")}
        description={t("sections.mediaDescription")}
      >
        <ProductImageField
          value={values.imageUrl}
          error={errors.imageUrl}
          disabled={disabled}
          onChange={(imageUrl) => set("imageUrl", imageUrl)}
        />
      </FormSection>

      <FormSectionDivider />

      <FormSection title={t("sections.visibility")}>
        <label
          htmlFor="product-published"
          className="bg-canvas-soft has-[:focus-visible]:ring-ring flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-[border-color] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 motion-reduce:transition-none"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-copy font-medium">{t("publishedLabel")}</span>
            <span className="text-muted-foreground text-copy-sm">
              {t("publishedDescription")}
            </span>
          </span>
          <Switch
            id="product-published"
            checked={values.published}
            disabled={disabled}
            onCheckedChange={(checked) => set("published", checked)}
          />
        </label>
      </FormSection>

      <FormSectionDivider />

      <ProductStockFields
        stocks={values.stocks}
        errors={errors}
        disabled={disabled}
        onChange={(stocks) => set("stocks", stocks)}
      />
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-error-deep text-copy-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
