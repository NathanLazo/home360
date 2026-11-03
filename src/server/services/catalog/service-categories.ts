import type { RequestCategory } from "~/schemas/marketplace/request-categories";

export { serviceCategoriesOf } from "~/schemas/marketplace/request-category-match";

/** `Service.category` mirrors the first declared category. */
export function primaryCategory(
  categories: readonly RequestCategory[],
): RequestCategory {
  return categories[0] ?? "Otro";
}
