import { cn } from "~/lib/utils";

export type ChartLegendItem = {
  label: string;
  color: string;
};

export type ChartSeriesLegendProps = {
  items: ChartLegendItem[];
  className?: string;
};

export function ChartSeriesLegend({
  items,
  className,
}: ChartSeriesLegendProps) {
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
