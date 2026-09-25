"use client";

import { useFormatter, useTranslations } from "next-intl";

import {
  AGENT_MODELS,
  type AgentModelId,
  type AgentModelOption,
} from "~/lib/agent/agent-models";
import { platformPricePerMillion } from "~/lib/agent/agent-pricing";
import { cn } from "~/lib/utils";

/**
 * Radio cards for the assistant's default model. Native radios do the
 * keyboard work (arrows move, Space selects); the card styles itself from the
 * input through `has-checked` / `has-focus-visible`, so focus and selection
 * never diverge from the real state.
 */
export function ProfileModelPicker({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: AgentModelId;
  disabled: boolean;
  onChange: (value: AgentModelId) => void;
}) {
  const t = useTranslations("profile.assistant");

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-copy-sm mb-3 font-medium">
        {t("defaultModel")}
      </legend>
      {AGENT_MODELS.map((model) => (
        <ModelOption
          key={model.id}
          name={name}
          model={model}
          checked={value === model.id}
          onChange={() => onChange(model.id)}
        />
      ))}
    </fieldset>
  );
}

function ModelOption({
  name,
  model,
  checked,
  onChange,
}: {
  name: string;
  model: AgentModelOption;
  checked: boolean;
  onChange: () => void;
}) {
  const t = useTranslations("profile.assistant");
  const format = useFormatter();
  const pricing = platformPricePerMillion(model);
  const usd = (value: number) =>
    format.number(value, { style: "currency", currency: "USD" });

  return (
    <label
      className={cn(
        "group border-hairline bg-card relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-[border-color,box-shadow] duration-150 ease-out",
        "hover:border-hairline-strong has-checked:border-foreground has-checked:shadow-hairline",
        "has-focus-visible:ring-ring has-focus-visible:ring-offset-background has-focus-visible:ring-2 has-focus-visible:ring-offset-2",
        "active:scale-[0.99] has-disabled:cursor-not-allowed has-disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
      )}
    >
      <input
        type="radio"
        name={name}
        value={model.id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="border-hairline-strong group-has-checked:border-foreground mt-0.5 size-4 shrink-0 rounded-full border-2 transition-[border-width,border-color] duration-150 ease-out group-has-checked:border-[5px] motion-reduce:transition-none"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-copy-sm font-medium">{model.label}</span>
          {model.free ? (
            <span className="bg-success-soft text-success-deep rounded-pill px-2 py-0.5 text-xs font-medium">
              {t("free")}
            </span>
          ) : null}
          {!model.supportsTools ? (
            <span className="border-hairline bg-canvas-soft text-muted-foreground rounded-pill border px-2 py-0.5 text-xs">
              {t("noTools")}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground text-label font-mono">
          {model.free
            ? t("contextWindow", {
                tokens: format.number(model.contextWindow, {
                  notation: "compact",
                }),
              })
            : t("pricePerMillion", {
                input: usd(pricing.inputUsdPerMillion),
                output: usd(pricing.outputUsdPerMillion),
              })}
        </span>
        {!model.free ? (
          <span className="text-muted-foreground text-label font-mono">
            {t("contextWindow", {
              tokens: format.number(model.contextWindow, {
                notation: "compact",
              }),
            })}
          </span>
        ) : null}
      </span>
    </label>
  );
}
