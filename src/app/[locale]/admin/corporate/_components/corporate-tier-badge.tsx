"use client";

import { useTranslations } from "next-intl";

import type { CorporateTierValue } from "./corporate.schema";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

/**
 * Tiers are commercial levels, not health states, so they read as neutral
 * zinc chips; only CUSTOM gets a slightly darker tone to flag negotiated deals.
 */
export function CorporateTierBadge({ tier }: { tier: CorporateTierValue }) {
  const t = useTranslations("admin.corporate.tier");

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        tier === "CUSTOM" && "border-zinc-300 bg-zinc-100 text-zinc-800",
      )}
    >
      {t(tier)}
    </Badge>
  );
}
