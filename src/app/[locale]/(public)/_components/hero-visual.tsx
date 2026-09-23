"use client";

import { useRef } from "react";
import {
  CameraIcon,
  CheckIcon,
  LockIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { LANDING_SAMPLE_ORDER } from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import { LandingBeam } from "./landing-beam";
import {
  dataLabelClass,
  inkSurfaceClass,
  LANDING_BEAM_RADIUS,
} from "./landing-styles";
import { MotionSafe } from "./motion-safe";
import { AnimatedBeam } from "~/components/ui/animated-beam";
import { cn } from "~/lib/utils";

/**
 * The custody record, rendered as a dark console: a sample order whose money
 * sits in escrow while its log fills in. The two path beams and the border
 * beam around the frame are the hero's only looping motion; everything
 * inside the console is still.
 *
 * The console is framed by the page's signature spectral beam, the brightest
 * color below the hero mesh, kept off the metal CTA so the two effects never
 * stack on one element.
 *
 * Client component because `AnimatedBeam` measures its endpoints through refs.
 * The ink surface scopes `.dark` tokens instead of a parallel palette.
 */
export function HeroVisual() {
  const t = useTranslations("landing.heroVisual");
  const locale = useLocale();

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

  const beamProps = {
    containerRef,
    pathColor: "var(--foreground)",
    pathOpacity: 0.14,
    gradientStartColor: "var(--foreground)",
    gradientStopColor: "var(--muted-foreground)",
    duration: 4,
    // The beam measures with `getBoundingClientRect`, which includes the
    // stage's scroll-linked scale. Stretching the SVG to its container maps
    // the measured (scaled) viewBox back onto the real box, so the beam stays
    // centred on its nodes at any scale.
    className: "size-full",
  };

  return (
    <LandingBeam
      size="md"
      colorVariant="colorful"
      theme="dark"
      strength={0.6}
      duration={3.2}
      borderRadius={LANDING_BEAM_RADIUS.xl}
      allowOverflow
    >
      <figure
        aria-label={t("alt")}
        className={cn(
          inkSurfaceClass,
          "shadow-modal relative w-full rounded-xl p-1.5",
        )}
      >
        <div className="bg-canvas rounded-lg border">
          {/* Title bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <p className={cn(dataLabelClass, "text-muted-foreground")}>
              {t("sampleLabel")}
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <span className="text-foreground tabular-nums">
                #{LANDING_SAMPLE_ORDER.reference}
              </span>
            </p>
            <p className="rounded-pill inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium">
              <LockIcon aria-hidden="true" className="size-3" />
              {t("status")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
            {/* Money + journey */}
            <div className="flex flex-col gap-8 p-5 sm:p-6 md:border-r">
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[clamp(2.25rem,5vw,3.25rem)] leading-none font-medium tracking-[-0.04em] tabular-nums">
                  {formatMxnFromCents(locale, LANDING_SAMPLE_ORDER.amountCents)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("amountLabel")}
                </p>
              </div>

              <div>
                {/* `overflow-hidden`: the beam SVG carries a measured pixel
                  width, so a stale value must never widen the card while the
                  resize observer catches up. */}
                <div
                  ref={containerRef}
                  className="relative grid grid-cols-3 overflow-hidden py-1"
                >
                  {nodes.map((node) => (
                    <div key={node.key} className="flex justify-center">
                      <div
                        ref={node.ref}
                        aria-hidden="true"
                        className="bg-card text-foreground relative z-10 flex size-11 items-center justify-center rounded-full border"
                      >
                        <node.Icon className="size-[1.125rem]" />
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
                          x2="83.333%"
                          y2="50%"
                          stroke="var(--foreground)"
                          strokeOpacity="0.14"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    }
                  >
                    <AnimatedBeam
                      {...beamProps}
                      fromRef={photoRef}
                      toRef={diagnosisRef}
                    />
                    <AnimatedBeam
                      {...beamProps}
                      fromRef={diagnosisRef}
                      toRef={escrowRef}
                      delay={1}
                    />
                  </MotionSafe>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {nodes.map((node) => (
                    <span
                      key={node.key}
                      className="text-muted-foreground block text-center text-xs leading-snug"
                    >
                      {node.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Order log */}
            <div className="border-t p-5 sm:p-6 md:border-t-0">
              <p className="text-sm font-medium">{t("logTitle")}</p>
              <ol className="mt-4 flex flex-col">
                {LANDING_SAMPLE_ORDER.events.map((event) => (
                  <li
                    key={event.key}
                    className="flex items-center gap-3 border-b border-dashed py-2.5 last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        event.done
                          ? "bg-foreground text-background"
                          : "text-muted-foreground",
                      )}
                    >
                      {event.done ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <event.icon className="size-3.5" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        event.done
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(`events.${event.key}`)}
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                      {event.time ?? t("pending")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </figure>
    </LandingBeam>
  );
}
