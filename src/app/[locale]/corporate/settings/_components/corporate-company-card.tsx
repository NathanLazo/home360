"use client";

import { useTranslations } from "next-intl";

import type { RouterOutputs } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export type CorporateSettings = NonNullable<
  RouterOutputs["corporate"]["getSettings"]["result"]
>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-copy-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * Company data. Name and RFC are negotiated with the HOME360 team (admin
 * `corporate.create/updateTerms`), so the portal shows them read-only.
 */
export function CorporateCompanyCard({
  settings,
}: {
  settings: CorporateSettings;
}) {
  const t = useTranslations("corporate.settings.company");
  const tierT = useTranslations("corporate.tier");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-display-sm">{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          <Row label={t("name")} value={settings.companyName} />
          <Row label={t("taxId")} value={settings.taxId ?? t("noTaxId")} />
          <Row label={t("tier")} value={tierT(settings.tier)} />
          <Row
            label={t("owner")}
            value={settings.owner.name ?? settings.owner.email ?? t("noOwner")}
          />
          {settings.owner.email ? (
            <Row label={t("email")} value={settings.owner.email} />
          ) : null}
          {settings.accountManager ? (
            <Row
              label={t("accountManager")}
              value={
                settings.accountManager.name ??
                settings.accountManager.email ??
                t("noOwner")
              }
            />
          ) : null}
        </dl>
        <p className="text-muted-foreground text-xs">{t("readOnlyHint")}</p>
      </CardContent>
    </Card>
  );
}
