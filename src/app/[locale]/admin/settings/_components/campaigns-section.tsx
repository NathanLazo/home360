"use client";

import { MegaphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { CampaignForm } from "./campaign-form";
import { CampaignHistory } from "./campaign-history";
import { SettingsSectionCard } from "./settings-section-card";
import { useCampaignMutations } from "./use-campaign-mutations";
import { Separator } from "~/components/ui/separator";

/**
 * "Campañas y anuncios": manual push broadcast from this panel. It lives
 * outside the settings form on purpose — sending is an immediate action, not
 * a setting that waits for "Guardar cambios".
 */
export function CampaignsSection() {
  const t = useTranslations("admin.settings.campaigns");
  const pendingReset = useRef<(() => void) | null>(null);
  const mutations = useCampaignMutations({
    onSent: () => {
      pendingReset.current?.();
      pendingReset.current = null;
    },
  });

  return (
    <SettingsSectionCard
      id="campaigns"
      title={t("title")}
      description={t("description")}
      icon={MegaphoneIcon}
    >
      <CampaignForm
        sending={mutations.sending}
        onSend={(input, reset) => {
          // The form clears only once the server confirms (see onSent).
          pendingReset.current = reset;
          mutations.send(input);
        }}
      />
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
          {t("historyTitle")}
        </h3>
        <CampaignHistory />
      </div>
    </SettingsSectionCard>
  );
}
