'use client';

import { EASE_OUT_CSS } from '~/lib/ease';
import { cn } from '~/lib/utils';

export interface UsageState {
  promptTokens: number;
  completionTokens: number;
  contextWindow: number;
}

export type UsageMeterVariant = 'Bar' | 'Inline';

export interface UsageMeterLabels {
  title: string;
  meter: string;
  prompt: string;
  completion: string;
}

const DEFAULT_LABELS: UsageMeterLabels = {
  title: 'Context window',
  meter: 'Context window usage',
  prompt: 'prompt',
  completion: 'response',
};

export interface UsageMeterProps {
  labels?: Partial<UsageMeterLabels>;
  usage: UsageState;
  variant?: UsageMeterVariant;
  className?: string;
}

function formatTokens(count: number) {
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1)}k`;
}

function usageRatio(usage: UsageState) {
  return Math.min(1, (usage.promptTokens + usage.completionTokens) / usage.contextWindow);
}

const RING_RADIUS = 6.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Small circular gauge of context usage, meant as a dropdown trigger icon. */
export function UsageRing({ usage, className }: { usage: UsageState; className?: string }) {
  const ratio = usageRatio(usage);
  const tone =
    ratio > 0.9 ? 'text-destructive' : ratio > 0.75 ? 'text-warning-deep' : 'text-foreground';

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-4 -rotate-90', className)}>
      <circle
        cx="8"
        cy="8"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        className="stroke-muted-foreground/25"
      />
      <circle
        cx="8"
        cy="8"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
        className={cn('stroke-current transition-[stroke-dashoffset] duration-500', tone)}
        style={{ transitionTimingFunction: EASE_OUT_CSS }}
      />
    </svg>
  );
}

export function UsageMeter({
  usage,
  variant = 'Bar',
  className,
  labels: labelOverrides,
}: UsageMeterProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const used = usage.promptTokens + usage.completionTokens;
  const ratio = Math.min(1, used / usage.contextWindow);
  const percent = Math.round(ratio * 100);

  const barColor =
    ratio > 0.9 ? 'bg-destructive/80' : ratio > 0.75 ? 'bg-warning/80' : 'bg-foreground';

  if (variant === 'Inline') {
    return (
      <div
        className={cn(
          'flex w-fit items-center gap-2.5 font-mono text-[11.5px] tabular-nums text-muted-foreground',
          className,
        )}
      >
        <span aria-hidden="true" className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <span
            className={cn('block h-full rounded-full transition-[width] duration-500', barColor)}
            style={{ width: `${percent}%`, transitionTimingFunction: EASE_OUT_CSS }}
          />
        </span>
        <span>
          {formatTokens(used)} / {formatTokens(usage.contextWindow)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-[380px]', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-medium text-foreground">{labels.title}</span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
          {formatTokens(used)} / {formatTokens(usage.contextWindow)} · {percent}%
        </span>
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={usage.contextWindow}
        aria-valuenow={used}
        aria-label={labels.meter}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn('block h-full rounded-full transition-[width] duration-500', barColor)}
          style={{ width: `${percent}%`, transitionTimingFunction: EASE_OUT_CSS }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
        <span>
          {labels.prompt} {formatTokens(usage.promptTokens)} · {labels.completion}{' '}
          {formatTokens(usage.completionTokens)}
        </span>
      </div>
    </div>
  );
}
