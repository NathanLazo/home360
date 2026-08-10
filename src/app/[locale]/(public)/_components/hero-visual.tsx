"use client";

import { useRef } from "react";
import { CameraIcon, ScanSearchIcon, ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { eyebrowClass } from "./landing-styles";
import { MotionSafe } from "./motion-safe";
import { AnimatedBeam } from "~/components/ui/animated-beam";

/**
 * The custody record: a schematic order card whose three nodes trace the only
 * journey that matters — photo, AI diagnosis, protected payment. The two beams
 * are the single looping animation allowed in the whole application (§4).
 *
 * Client component because `AnimatedBeam` measures its endpoints through refs.
 */
export function HeroVisual() {
  const t = useTranslations("landing.heroVisual");

  const containerRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const diagnosisRef = useRef<HTMLDivElement>(null);
  const escrowRef = useRef<HTMLDivElement>(null);

  const nodes = [
    { key: "photo", ref: photoRef, Icon: CameraIcon, label: t("photoLabel") },
    {
      key: "diagnosis",
      ref: diagnosisRef,
      Icon: ScanSearchIcon,
      label: t("diagnosisLabel"),
    },
    {
      key: "escrow",
      ref: escrowRef,
      Icon: ShieldCheckIcon,
      label: t("escrowLabel"),
    },
  ];

  return (
    <figure
      aria-label={t("alt")}
      className="relative w-full rounded-lg border border-[color-mix(in_srgb,var(--brand-gold)_55%,transparent)] bg-[var(--brand-cream)] p-5 shadow-[0_24px_60px_-32px_rgb(0_0_0/0.9)] sm:p-6"
    >
      {/* Schematic order sheet: shape only, never carries information. */}
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--brand-navy)_12%,transparent)] bg-[color-mix(in_srgb,var(--brand-navy)_6%,transparent)]">
          <CameraIcon className="size-8 text-[color-mix(in_srgb,var(--brand-navy)_28%,transparent)]" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="block h-2 w-3/5 rounded-full bg-[color-mix(in_srgb,var(--brand-navy)_16%,transparent)]" />
          <span className="block h-2 w-2/5 rounded-full bg-[color-mix(in_srgb,var(--brand-navy)_10%,transparent)]" />
        </div>
      </div>

      <div className="my-5 h-px w-full bg-[color-mix(in_srgb,var(--brand-navy)_14%,transparent)]" />

      {/* `overflow-hidden`: the beam SVG carries a measured pixel width, so a
          stale value must never widen the card while the resize observer
          catches up. */}
      <div
        ref={containerRef}
        className="relative grid grid-cols-3 overflow-hidden"
      >
        {nodes.map((node) => (
          <div key={node.key} className="flex justify-center">
            <div
              ref={node.ref}
              aria-hidden="true"
              className="relative z-10 flex size-11 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--brand-navy)_20%,transparent)] bg-[var(--brand-cream)] text-[var(--brand-navy)]"
            >
              <node.Icon className="size-5" />
            </div>
          </div>
        ))}

        <MotionSafe
          fallback={
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
            >
              <line
                x1="16.667%"
                y1="50%"
                x2="50%"
                y2="50%"
                stroke="var(--brand-navy)"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="50%"
                y1="50%"
                x2="83.333%"
                y2="50%"
                stroke="var(--brand-navy)"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          }
        >
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={photoRef}
            toRef={diagnosisRef}
            pathColor="var(--brand-navy)"
            pathOpacity={0.25}
            gradientStartColor="var(--brand-gold)"
            gradientStopColor="var(--brand-navy)"
            duration={4}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={diagnosisRef}
            toRef={escrowRef}
            pathColor="var(--brand-navy)"
            pathOpacity={0.25}
            gradientStartColor="var(--brand-gold)"
            gradientStopColor="var(--brand-navy)"
            duration={4}
            delay={1}
          />
        </MotionSafe>
      </div>

      <figcaption className="mt-3 grid grid-cols-3 gap-2">
        {nodes.map((node) => (
          <span
            key={node.key}
            className={`${eyebrowClass} block text-center text-[color-mix(in_srgb,var(--brand-navy)_78%,transparent)]`}
          >
            {node.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
