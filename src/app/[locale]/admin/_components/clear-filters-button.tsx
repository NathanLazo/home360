"use client";

import { FilterXIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";

/**
 * Empty-state CTA for filtered lists: when a search or filter produced zero
 * rows, the one useful next step is to widen it again.
 */
export function ClearFiltersButton({ onClear }: { onClear: () => void }) {
  const t = useTranslations("admin.filters");

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClear}
    >
      <FilterXIcon aria-hidden="true" />
      {t("clear")}
    </Button>
  );
}
