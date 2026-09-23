import { dataLabelClass } from "./landing-styles";
import { cn } from "~/lib/utils";

type DiagnosisSampleProps = {
  label: string;
  rows: readonly { key: string; term: string; value: string }[];
};

/**
 * A sample AI readout, set as a definition list: the diagnosis is data, so it
 * reads as data. Labelled as a sample on screen.
 */
export function DiagnosisSample({ label, rows }: DiagnosisSampleProps) {
  return (
    <div className="bg-canvas-soft rounded-md border p-4">
      <p className={cn(dataLabelClass, "text-muted-foreground")}>{label}</p>
      <dl className="mt-3 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-0.5 border-b border-dashed py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <dt className="text-copy-sm text-muted-foreground">{row.term}</dt>
            <dd className="text-copy-sm text-foreground font-medium sm:text-right">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
