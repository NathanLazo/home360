"use client";

import { EyeIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { getPathname } from "~/i18n/navigation";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

type ImpersonationBannerProps = {
  /** Business or corporate account whose panel the admin is viewing. */
  subjectName: string;
};

/**
 * Persistent notice while an ADMIN views a business or corporate panel. The
 * layout renders it only when the server session carries an impersonator;
 * read-only is enforced by `protectedProcedure`, this only explains it and
 * offers the way out. Exiting hard-navigates so no cached panel data
 * survives into the admin shell.
 */
export function ImpersonationBanner({ subjectName }: ImpersonationBannerProps) {
  const t = useTranslations("common.impersonation");
  const errorsT = useTranslations("errors");
  const locale = useLocale();
  const stop = api.admin.impersonation.stop.useMutation({
    onSuccess: (response) => {
      if (response.error !== null || response.result === null) {
        toast.error(errorsT(response.error ?? "UNKNOWN_ERROR"));
        return;
      }

      window.location.assign(
        getPathname({ href: response.result.returnTo, locale }),
      );
    },
    onError: (error) => toast.error(errorsT(toErrorCode(error))),
  });
  // Stays pending through the navigation so the button cannot fire twice.
  const exiting = stop.isPending || stop.data?.result != null;

  return (
    <Alert variant="info" role="status">
      <EyeIcon aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{t("description", { name: subjectName })}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={exiting}
          onClick={() => stop.mutate()}
        >
          {exiting ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : null}
          {exiting ? t("exiting") : t("exit")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
