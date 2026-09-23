"use client";

import { ArrowRightIcon } from "lucide-react";

import { HERO_CTA_ATTRIBUTE } from "./use-hero-cta-in-view";
import { Magnetic } from "./magnetic";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

type MetalCtaProps = {
  href: "/register";
  label: string;
};

/**
 * The hero's key CTA: the liquid-metal primary with the live ring and the
 * liquid dent under the cursor (`metal="bend"`, the page's single bend),
 * inside a magnetic wrapper. The static chrome rim paints on the server,
 * without WebGL2 and under reduced motion; the magnet is off there too.
 *
 * Carries the marker the nav observes to keep the live-metal budget (see
 * `LandingHeader`).
 */
export function MetalCta({ href, label }: MetalCtaProps) {
  const markerProps = { [HERO_CTA_ATTRIBUTE]: "" };

  return (
    <div {...markerProps} className="inline-flex">
      <Magnetic>
        <Button asChild size="pill" metal="bend">
          <Link href={href} className="group/cta">
            {label}
            <ArrowRightIcon
              aria-hidden="true"
              className="transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </Button>
      </Magnetic>
    </div>
  );
}
