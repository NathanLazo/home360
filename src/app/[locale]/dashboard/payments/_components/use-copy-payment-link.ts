"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

/** Copies a payment link URL with localized feedback; denial is non-fatal. */
export function useCopyPaymentLink() {
  const t = useTranslations("dashboard.payments.link");

  return async function copyPaymentLink(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
      return true;
    } catch {
      toast.error(t("copyFailed"));
      return false;
    }
  };
}
