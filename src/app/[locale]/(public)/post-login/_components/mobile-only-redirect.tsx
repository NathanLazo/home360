"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "~/i18n/navigation";

export function MobileOnlyRedirect() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    toast(t("mobileOnly"));
    router.replace("/");
  }, [router, t]);
  return (
    <main className="bg-canvas-soft flex min-h-dvh items-center justify-center px-4">
      <p role="status" className="text-muted-foreground text-copy-sm">
        {t("redirecting")}
      </p>
    </main>
  );
}
