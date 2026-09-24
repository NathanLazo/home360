'use client';

import { useState } from 'react';

import { EASE_OUT_CSS } from '~/lib/ease';
import { cn } from '~/lib/utils';

export type ToolChipStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export interface ToolChipCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: ToolChipStatus;
}

const DOT: Record<ToolChipStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-primary/80 motion-safe:animate-pulse',
  success: 'bg-success/80',
  error: 'bg-destructive/80',
  cancelled: 'bg-muted-foreground/60',
};

export type ToolChipsVariant = 'Row' | 'Stack';

export interface ToolChipsProps {
  calls: ToolChipCall[];
  variant?: ToolChipsVariant;
  /** Etiqueta del chip mientras la herramienta corre; tradúcela en el consumidor. */
  runningLabel?: string;
  className?: string;
}

export function ToolChips({
  calls,
  variant = 'Row',
  runningLabel = 'en curso',
  className,
}: ToolChipsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = calls.find((call) => call.id === openId);
  const hasDetail = Boolean(open && (Boolean(open.result) || Boolean(open.args)));

  return (
    <div className={cn('w-full max-w-[480px]', className)}>
      <div className={cn('flex gap-1.5', variant === 'Stack' ? 'flex-col' : 'flex-wrap')}>
        {calls.map((call) => {
          const active = call.id === openId;
          return (
            <button
              key={call.id}
              type="button"
              aria-expanded={active}
              onClick={() => setOpenId(active ? null : call.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border py-1.5 pl-2.5 pr-3 text-left',
                'transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-border bg-muted/60'
                  : 'border-border/60 hover:border-border',
                variant === 'Stack' && 'w-full',
              )}
            >
              <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', DOT[call.status])} />
              <span className="truncate font-mono text-[11.5px] font-medium text-foreground/80">
                {call.name}
              </span>
              {call.status === 'running' ? (
                <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wide text-primary">
                  {runningLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-[240ms]"
        style={{
          gridTemplateRows: hasDetail ? '1fr' : '0fr',
          transitionTimingFunction: EASE_OUT_CSS,
        }}
      >
        <div className="overflow-hidden">
          {hasDetail && open && (
            <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2.5">
              {open.args && Object.keys(open.args).length > 0 && (
                <p className="mb-1.5 truncate font-mono text-[10.5px] text-muted-foreground/70">
                  {JSON.stringify(open.args)}
                </p>
              )}
              {open.result && (
                <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.6] text-muted-foreground">
                  {open.result}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
