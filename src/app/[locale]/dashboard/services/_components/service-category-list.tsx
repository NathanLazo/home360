"use client";

import { useTranslations } from "next-intl";

import type { ServiceListItem } from "./service.types";
import { useCategoryLabel } from "~/hooks/use-category-label";
import { serviceCategoriesOf } from "~/schemas/marketplace/request-category-match";

const VISIBLE = 2;

/** Table cell: first categories by name, the rest collapsed into "+N". */
export function ServiceCategoryList({
  service,
}: {
  service: Pick<ServiceListItem, "category" | "categories">;
}) {
  const t = useTranslations("dashboard.services");
  const label = useCategoryLabel();
  const categories = serviceCategoriesOf(service);

  if (categories.length === 0) {
    return <span className="text-muted-foreground">{service.category}</span>;
  }

  const hidden = categories.length - VISIBLE;

  return (
    <span
      className="text-muted-foreground"
      title={categories.map(label).join(", ")}
    >
      {categories.slice(0, VISIBLE).map(label).join(", ")}
      {hidden > 0 ? (
        <span className="font-mono tabular-nums">
          {" "}
          {t("categoriesMore", { count: hidden })}
        </span>
      ) : null}
    </span>
  );
}
