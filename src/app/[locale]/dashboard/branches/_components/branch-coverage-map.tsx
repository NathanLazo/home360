export function BranchCoverageMap({ radiusKm }: { radiusKm: number }) {
  return (
    <div
      aria-hidden="true"
      className="bg-muted/30 relative h-28 overflow-hidden border-y"
    >
      <svg
        viewBox="0 0 320 112"
        className="text-border h-full w-full"
        preserveAspectRatio="none"
      >
        {[32, 64, 96, 128, 160, 192, 224, 256, 288].map((x) => (
          <line
            key={`x-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="112"
            stroke="currentColor"
          />
        ))}
        {[28, 56, 84].map((y) => (
          <line
            key={`y-${y}`}
            x1="0"
            y1={y}
            x2="320"
            y2={y}
            stroke="currentColor"
          />
        ))}
        <circle
          cx="160"
          cy="56"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="160"
          cy="56"
          r="27"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="160"
          cy="56"
          r="5"
          className="fill-foreground"
          stroke="none"
        />
      </svg>
      <span className="bg-background/95 text-foreground absolute right-3 bottom-3 rounded-md border px-2 py-1 font-mono text-xs font-medium shadow-sm">
        {radiusKm} km
      </span>
    </div>
  );
}
