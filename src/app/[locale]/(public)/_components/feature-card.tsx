import { type LucideIcon } from "lucide-react";

import { subheadingClass } from "./landing-styles";
import { BorderBeam } from "~/components/ui/border-beam";

type FeatureCardProps = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * A statement about the product, not a control: no `onClick`, no link, nothing
 * that pretends to be a button. The `BorderBeam` only shows on hover and is
 * dropped entirely under reduced motion, where the static gold hairline stays.
 */
export function FeatureCard({ Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--brand-navy)_12%,transparent)] bg-white p-6 shadow-[0_1px_2px_rgb(13_27_42/0.04)] transition-[box-shadow,border-color] duration-300 hover:border-[color-mix(in_srgb,var(--brand-gold)_70%,transparent)] hover:shadow-[0_12px_32px_-20px_rgb(13_27_42/0.45)]">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-md bg-[var(--brand-navy)] text-[var(--brand-cream)]"
      >
        <Icon className="size-5" />
      </span>
      <h3 className={`${subheadingClass} text-[var(--brand-navy)]`}>{title}</h3>
      <p className="text-[0.9375rem] leading-relaxed text-pretty text-[color-mix(in_srgb,var(--brand-navy)_72%,transparent)]">
        {description}
      </p>

      <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <BorderBeam
          size={64}
          duration={6}
          borderWidth={2}
          colorFrom="var(--brand-gold)"
          colorTo="var(--brand-navy)"
        />
      </div>
    </div>
  );
}
