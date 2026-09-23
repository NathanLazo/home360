"use client";

import { SparklesIcon } from "lucide-react";
import { MetalFx } from "metal-fx";

import { dataLabelClass } from "./landing-styles";
import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { cn } from "~/lib/utils";

type MetalRecommendedPillProps = {
  label: string;
};

/**
 * Silver ring around the "recommended" label of the featured plan. The label
 * is real text plus an icon, so the cue never depends on the metal; under
 * reduced motion the ring holds still.
 */
export function MetalRecommendedPill({ label }: MetalRecommendedPillProps) {
  const prefersReducedMotion = useLandingReducedMotion();

  return (
    <MetalFx
      preset="silver"
      variant="button"
      theme="dark"
      strength={0.9}
      paused={prefersReducedMotion}
    >
      <p
        className={cn(
          dataLabelClass,
          "bg-background text-foreground inline-flex h-7 items-center gap-1.5 rounded-full px-3",
        )}
      >
        <SparklesIcon aria-hidden="true" className="size-3" />
        {label}
      </p>
    </MetalFx>
  );
}
