import type { ProductListItem } from "./product.types";
import { StatusBadge } from "~/components/status-badge";

const variants = {
  DRAFT: "muted",
  PUBLISHED: "success",
} as const;

export function ProductStatusBadge({
  status,
  label,
}: {
  status: ProductListItem["status"];
  label: string;
}) {
  return <StatusBadge status={status} variantMap={variants} label={label} />;
}
