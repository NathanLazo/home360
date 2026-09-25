"use client";

import { useState } from "react";
import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { hasLocale, useLocale, useTranslations } from "next-intl";

import type { MutationOutcome } from "./profile.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { Button } from "~/components/ui/button";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

/**
 * Revokes every session (web and mobile). Rare, deliberate action: a standard
 * confirm, no celebration; on success this session ends too.
 */
export function ProfileSignOutEverywhere({
  disabled,
  pending,
  onConfirm,
}: {
  disabled: boolean;
  pending: boolean;
  onConfirm: () => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.security.signOutEverywhere");
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleConfirm() {
    const outcome = await onConfirm();

    if (!outcome.ok) {
      setOpen(false);
      return;
    }

    setSigningOut(true);
    try {
      await signOut({ redirectTo: getPathname({ href: "/login", locale }) });
    } catch {
      setSigningOut(false);
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h3 className="text-copy font-semibold">{t("title")}</h3>
        <p className="text-muted-foreground text-copy-sm">{t("description")}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full shrink-0 sm:w-auto"
      >
        <LogOutIcon aria-hidden="true" />
        {t("action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending && !signingOut) setOpen(next);
        }}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        loading={pending || signingOut}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
