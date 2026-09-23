import { figureClass } from "./landing-styles";
import { cn } from "~/lib/utils";

type MetricItemProps = {
  figure: React.ReactNode;
  label: string;
};

/** One market figure: the number is the headline, the label says what of. */
export function MetricItem({ figure, label }: MetricItemProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-6 sm:p-8">
      <p className={cn(figureClass, "text-foreground")}>{figure}</p>
      <p className="text-muted-foreground max-w-[28ch] text-[0.9375rem] leading-relaxed text-pretty">
        {label}
      </p>
    </div>
  );
}
