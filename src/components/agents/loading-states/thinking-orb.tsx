'use client';

import type { ReactNode } from 'react';
import {
  ThinkingOrb,
  type OrbSize,
  type OrbState,
  type OrbTheme,
  type ThinkingOrbProps,
} from 'thinking-orbs';

import { cn } from '~/lib/utils';

import { ThinkingShimmer } from './thinking-shimmer';

export type { OrbState, OrbSize, OrbTheme };

export interface ThinkingOrbGlyphProps
  extends Omit<ThinkingOrbProps, 'state' | 'size' | 'theme'> {
  state?: OrbState;
  size?: OrbSize;
  decorative?: boolean;
  /**
   * Paleta del orbe. Por defecto sigue el tema de la app (`auto`); púlsala a
   * `dark` cuando el orbe viva sobre una superficie de color fija (p. ej. el
   * botón primario), donde el tinte claro es el único que contrasta.
   */
  theme?: OrbTheme;
}

export function ThinkingOrbGlyph({
  state = 'working',
  size = 64,
  decorative = false,
  theme = 'auto',
  className,
  ...props
}: ThinkingOrbGlyphProps) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      aria-hidden={decorative || undefined}
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}

export interface ThinkingOrbStatusProps {
  /** Which orb animation to show. */
  state?: OrbState;
  /** Label rendered next to the orb; also what screen readers announce. */
  children?: ReactNode;
  /** Tuned orb preset: 20 for inline text, 64 for avatar scale. */
  size?: OrbSize;
  /** Multiplier on the preset's baked speed. */
  speed?: number;
  className?: string;
}

/**
 * Pairs a `thinking-orbs` canvas orb with the shimmering status label used
 * across the agent UI. The orb is decorative — the label carries the meaning,
 * so the canvas is hidden from the accessibility tree to avoid a double
 * announcement.
 */
export function ThinkingOrbStatus({
  state = 'working',
  children,
  size = 20,
  speed,
  className,
}: ThinkingOrbStatusProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
    >
      <ThinkingOrbGlyph
        state={state}
        size={size}
        speed={speed}
        decorative
      />
      <ThinkingShimmer>{children}</ThinkingShimmer>
    </span>
  );
}
