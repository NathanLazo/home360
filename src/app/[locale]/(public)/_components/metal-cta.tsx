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
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

type MetalCtaProps = {
  href: "/register";
  label: string;
  className?: string;
};

const BEND_OFF: BendConfig = { ...BEND_DEFAULTS, enabled: false };
const BEND_ON: BendConfig = { ...BEND_DEFAULTS, enabled: true };

/**
 * The page's one liquid-metal moment: the primary "register" CTA wears a
 * chromatic ring that dents under the cursor, inside a magnetic wrapper.
 *
 * `MetalFx` renders the plain link on the server and on browsers without
 * WebGL2, so the CTA always works. Under reduced motion the shader is paused
 * (the ring stays as a still frame) and the bend and magnet are off.
 *
 * `normalizeHostStyles` is off: it would strip the outline this link uses as
 * its focus ring.
 */
export function MetalCta({ href, label, className }: MetalCtaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const bendRef = useRef<BendConfig>(BEND_OFF);

  useEffect(() => {
    bendRef.current = prefersReducedMotion ? BEND_OFF : BEND_ON;
  }, [prefersReducedMotion]);

  useMetalBend(ref, () => bendRef.current);

  return (
    <Magnetic className={className}>
      <MetalFx
        ref={ref}
        preset="chromatic"
        variant="button"
        theme="light"
        innerShadow
        paused={prefersReducedMotion}
        normalizeHostStyles={false}
        className="transition-[scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
      >
        <Link
          href={href}
          className={cn(
            "group/cta bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium",
            "focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
          )}
        >
          {label}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </MetalFx>
    </Magnetic>
  );
}
