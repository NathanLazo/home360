import { LANDING_EASE, LANDING_DURATION } from "./landing-styles";
import { BlurFade } from "~/components/ui/blur-fade";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Delay in milliseconds, so callers speak the language of the directive. */
  delayMs?: number;
  /** Duration in milliseconds; defaults to the standard 300 ms. */
  durationMs?: number;
};

/**
 * The landing's single entrance pattern (§4): 16 px up + opacity + blur,
 * `inView` once, signature easing, zero overshoot. Centralising it here keeps
 * every section on the same curve instead of BlurFade's own `easeOut`.
 *
 * Under reduced motion `BlurFade` renders the final state directly, so this
 * wrapper never hides content.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
  durationMs = LANDING_DURATION.standard,
}: RevealProps) {
  return (
    <BlurFade
      className={className}
      inView
      direction="up"
      offset={16}
      blur="8px"
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
