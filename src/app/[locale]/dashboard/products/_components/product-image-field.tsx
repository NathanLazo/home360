"use client";

import { useEffect, useState } from "react";
import { ImageIcon, ImageOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function previewableUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/**
 * Public catalog image as an HTTPS URL with a live preview. Business uploads
 * are not wired to Blob yet (media kinds are private, signed mobile uploads),
 * so the URL is the supported input.
 */
export function ProductImageField({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("dashboard.products.form.image");
  const previewUrl = previewableUrl(value);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [previewUrl]);

  return (
    <div className="flex items-start gap-4">
      <div
        className="bg-canvas-soft shadow-hairline flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md"
        aria-hidden="true"
      >
        {previewUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary business-provided host; next/image would need an open remotePatterns list.
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : broken ? (
          <ImageOffIcon className="text-muted-foreground size-5" />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label htmlFor="product-imageUrl">{t("label")}</Label>
        <Input
          id="product-imageUrl"
          name="imageUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={t("placeholder")}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "product-imageUrl-error" : "product-imageUrl-help"
          }
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? (
          <p
            id="product-imageUrl-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {error}
          </p>
        ) : (
          <p
            id="product-imageUrl-help"
            className="text-muted-foreground text-copy-sm"
          >
            {broken ? t("previewError") : t("help")}
          </p>
        )}
      </div>
    </div>
  );
}
