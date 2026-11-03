"use client";

import { useTranslations } from "next-intl";

import {
  isRequestCategory,
  REQUEST_CATEGORY_MESSAGE_KEYS,
} from "~/schemas/marketplace/request-categories";

/**
 * Localized label of a marketplace category. Values outside the fixed
 * taxonomy (legacy free-text service categories) are shown as stored.
 */
export function useCategoryLabel(): (category: string) => string {
  const t = useTranslations("common.serviceCategory");

  return (category) =>
    isRequestCategory(category)
      ? t(REQUEST_CATEGORY_MESSAGE_KEYS[category])
      : category;
}
