import { LANDING_DURATION, LANDING_EASE } from "./landing-styles";
import { BlurFade } from "~/components/ui/blur-fade";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Delay in milliseconds. */
  delayMs?: number;
  /** Duration in milliseconds; defaults to the 600 ms reveal. */
  durationMs?: number;
};

/**
 * The landing's block entrance: 12 px up + opacity + blur, `inView` once, on
 * the strong ease-out. Headings use `SplitHeading` instead, so a section never
 * enters with one identical move for everything.
 *
 * Under reduced motion `BlurFade` renders the final state directly, so this
 * wrapper never hides content.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
  durationMs = LANDING_DURATION.reveal,
}: RevealProps) {
  return (
    <BlurFade
      className={className}
      inView
      inViewMargin="-80px"
      direction="up"
      offset={12}
      blur="6px"
      transition={{
        delay: delayMs / 1000,
        duration: durationMs / 1000,
        ease: LANDING_EASE,
      }}
    >
      {children}
    </BlurFade>
  );
}
