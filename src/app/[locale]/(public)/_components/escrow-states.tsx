import { cn } from "~/lib/utils";

type EscrowStatesProps = {
  states: readonly { key: string; label: string }[];
};

/**
 * The escrow lifecycle as three segments of one track. The last state is the
 * only one filled: money moves once, at the end.
 */
export function EscrowStates({ states }: EscrowStatesProps) {
  return (
    <ol className="grid grid-cols-3 gap-1.5">
      {states.map((state, index) => {
        const isFinal = index === states.length - 1;
        return (
          <li key={state.key} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "block h-1.5 rounded-full",
                isFinal ? "bg-foreground" : "bg-foreground/15",
              )}
            />
            <span
              className={cn(
                "text-xs",
                isFinal
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {state.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
