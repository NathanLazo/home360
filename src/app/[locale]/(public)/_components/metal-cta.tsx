"use client";

import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "lucide-react";
import {
  BEND_DEFAULTS,
  MetalFx,
  useMetalBend,
  type BendConfig,
} from "metal-fx";

import { Magnetic } from "./magnetic";
import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { HERO_CTA_ATTRIBUTE } from "./use-hero-cta-in-view";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

type MetalCtaProps = {
  href: "/register";
  label: string;
};

const BEND_OFF: BendConfig = { ...BEND_DEFAULTS, enabled: false };
const BEND_ON: BendConfig = { ...BEND_DEFAULTS, enabled: true };

/**
 * The page's signature liquid-metal moment: the "register" CTA wears the
 * full-strength chromatic ring (not the product's quieter silver) that dents
 * under the cursor, inside a magnetic wrapper. Deliberately bypasses
 * `Button metal` so the plain ink pill carries no static chrome rim under
 * the live ring.
 *
 * `MetalFx` renders the plain link on the server and without WebGL2. Under
 * reduced motion the shader is paused (still frame) and bend and magnet are
 * off. `normalizeHostStyles` is off to keep the outline focus ring.
 *
 * Carries the marker the nav observes to keep the live-metal budget (see
 * `LandingHeader`).
 */
export function MetalCta({ href, label }: MetalCtaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const bendRef = useRef<BendConfig>(BEND_OFF);
  const markerProps = { [HERO_CTA_ATTRIBUTE]: "" };

  useEffect(() => {
    bendRef.current = prefersReducedMotion ? BEND_OFF : BEND_ON;
  }, [prefersReducedMotion]);

  useMetalBend(ref, () => bendRef.current);

  return (
    <div {...markerProps} className="inline-flex">
      <Magnetic>
        <MetalFx
          ref={ref}
          preset="chromatic"
          variant="button"
          theme="light"
          innerShadow
          paused={prefersReducedMotion}
          normalizeHostStyles={false}
          className="transition-[scale] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none"
        >
          <Link
            href={href}
            className={cn(
              "group/cta bg-primary text-primary-foreground rounded-pill inline-flex h-12 items-center gap-2 px-6 text-base font-medium",
              "focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
            )}
          >
            {label}
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </MetalFx>
      </Magnetic>
    </div>
  );
}
