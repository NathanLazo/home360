import { cn } from "~/lib/utils";

type LearnMoreChevronProps = {
  className?: string;
};

const ARM_CLASS =
  "origin-[10px_8px] transition-[transform] duration-[350ms] ease-out [transform-box:view-box] [vector-effect:non-scaling-stroke] motion-reduce:transition-none";

/**
 * Trailing chevron for "learn more" links (transitions.dev #24): on hover it
 * slides toward the reading direction while its arms open about the apex,
 * then eases back. The parent link must carry `group/learn`.
 *
 * Hover-only affordance: focus and touch keep the resting chevron, so the
 * motion never carries meaning on its own.
 */
export function LearnMoreChevron({ className }: LearnMoreChevronProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex transition-transform duration-[350ms] ease-out group-hover/learn:translate-x-0.5 motion-reduce:transition-none",
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="size-4 overflow-visible"
      >
        <path
          d="M6 4L10 8"
          className={cn(
            ARM_CLASS,
            "group-hover/learn:[transform:rotate(8deg)]",
          )}
        />
        <path
          d="M10 8L6 12"
          className={cn(
            ARM_CLASS,
            "group-hover/learn:[transform:rotate(-8deg)]",
          )}
        />
      </svg>
    </span>
  );
}
