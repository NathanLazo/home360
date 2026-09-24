"use client";

import { useTranslations } from "next-intl";

import { StatusBadge } from "~/components/status-badge";

type LinkState = "connected" | "notConnected";

const LINK_VARIANTS = { connected: "success", notConnected: "muted" } as const;

/** Read-only: linking and unlinking are out of scope for this screen. */
export function ProfileLinkedAccounts({ providers }: { providers: string[] }) {
  const t = useTranslations("profile.security.linked");
  const google: LinkState = providers.includes("google")
    ? "connected"
    : "notConnected";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-copy font-semibold">{t("title")}</h3>
      <dl className="flex items-center justify-between gap-4">
        <dt className="text-copy-sm">{t("google")}</dt>
        <dd>
          <StatusBadge
            status={google}
            variantMap={LINK_VARIANTS}
            label={t(google)}
          />
        </dd>
      </dl>
      <p className="text-muted-foreground text-copy-sm">{t("note")}</p>
    </div>
  );
}
