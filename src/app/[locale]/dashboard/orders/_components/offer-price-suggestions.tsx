"use client";

import { useTranslations } from "next-intl";

import type { PriceSuggestion } from "./offer-price";
import { useMoney } from "./use-money";
import { Button } from "~/components/ui/button";

/**
 * One-tap price pills under the price field: the business taps instead of
 * typing. The active pill is marked with `aria-pressed`.
 */
export function OfferPriceSuggestions({
  suggestions,
  selectedCents,
  disabled,
  onPick,
}: {
  suggestions: PriceSuggestion[];
  selectedCents: number | null;
  disabled: boolean;
  onPick: (cents: number) => void;
}) {
  const t = useTranslations("dashboard.requests.offerForm.suggestions");
  const money = useMoney();

  if (suggestions.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex flex-wrap gap-1.5"
    >
      {suggestions.map((suggestion) => {
        const selected = suggestion.cents === selectedCents;

        return (
          <Button
            key={`${suggestion.kind}-${suggestion.cents}`}
            type="button"
            size="xs"
            variant={selected ? "secondary" : "outline"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onPick(suggestion.cents)}
            className="font-mono tabular-nums"
          >
            <span className="text-muted-foreground font-sans">
              {t(suggestion.kind)}
            </span>
            {money(suggestion.cents)}
          </Button>
        );
      })}
    </div>
  );
}
