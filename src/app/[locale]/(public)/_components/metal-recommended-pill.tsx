"use client";

import { SparklesIcon } from "lucide-react";
import { MetalFx } from "metal-fx";

import { dataLabelClass } from "./landing-styles";
import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { MetalFxFallback } from "~/components/metal/metal-fx-fallback";
import { useHydrated } from "~/hooks/use-hydrated";
import { cn } from "~/lib/utils";

type MetalRecommendedPillProps = {
  label: string;
};

/**
 * Silver ring around the "recommended" label of the featured plan. The label
 * is real text plus an icon, so the cue never depends on the metal; under
 * reduced motion the ring holds still. SSR and the hydration render paint
 * the library's no-WebGL wrapper; `MetalFx` (which picks its tree from WebGL2
 * support during render) mounts after hydration to avoid React #418.
 */
export function MetalRecommendedPill({ label }: MetalRecommendedPillProps) {
  const prefersReducedMotion = useLandingReducedMotion();
  const hydrated = useHydrated();
  const pill = (
    <p
      className={cn(
        dataLabelClass,
        "bg-background text-foreground inline-flex h-7 items-center gap-1.5 rounded-full px-3",
      )}
    >
      <SparklesIcon aria-hidden="true" className="size-3" />
      {label}
    </p>
  );

  if (!hydrated) {
    return <MetalFxFallback>{pill}</MetalFxFallback>;
  }

  return (
    <MetalFx
      preset="silver"
      variant="button"
      theme="dark"
      strength={0.9}
      paused={prefersReducedMotion}
    >
      {pill}
    </MetalFx>
  );
}
