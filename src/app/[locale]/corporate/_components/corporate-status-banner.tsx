import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CorporateStatus } from "../../../../../generated/prisma";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

export type CorporateStatusBannerProps = {
  status: CorporateStatus;
  statusReason: string | null;
  locale: string;
};

/**
 * Persistent notice for non-active accounts: reads stay available, but the
 * user should understand why every mutation is disabled. `statusReason` is
 * the only internal note the router exposes, so nothing else leaks here.
 */
export async function CorporateStatusBanner({
  status,
  statusReason,
  locale,
}: CorporateStatusBannerProps) {
  if (status === "ACTIVE") {
    return null;
  }

  const t = await getTranslations({
    locale,
    namespace: "corporate.statusBanner",
  });

  return (
    <Alert role="status" className="border-amber-200 bg-amber-50 text-amber-900">
      <TriangleAlertIcon aria-hidden="true" className="size-4" />
      <AlertTitle>{t(status)}</AlertTitle>
      {statusReason ? (
        <AlertDescription className="text-amber-900/80">
          {t("reasonLabel")}: {statusReason}
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
