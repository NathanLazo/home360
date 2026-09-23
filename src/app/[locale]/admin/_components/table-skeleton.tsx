import {
  ADMIN_TABLE_CARD_CLASS,
  ADMIN_TABLE_HEAD_STRIP_CLASS,
} from "./admin-surface";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

export type TableSkeletonColumn = {
  /** Tailwind width of the placeholder bar, e.g. `w-32`. */
  width: string;
  align?: "start" | "end";
  /** Leading avatar/icon circle, for identity columns. */
  withAvatar?: boolean;
};

/**
 * Loading shape of an admin table: a header strip and rows with one bar per
 * real column, inside the same flush card the loaded table uses.
 */
export function TableSkeleton({
  columns,
  rows = 6,
  label,
}: {
  columns: TableSkeletonColumn[];
  rows?: number;
  label?: string;
}) {
  const template = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <Card className={ADMIN_TABLE_CARD_CLASS} aria-busy="true" role="status">
      {label ? <span className="sr-only">{label}</span> : null}
      <CardContent className="px-0" aria-hidden="true">
        <div
          className={cn(
            "grid h-10 items-center gap-4 px-3",
            ADMIN_TABLE_HEAD_STRIP_CLASS,
          )}
          style={template}
        >
          {columns.map((column, index) => (
            <Skeleton
              key={index}
              className={cn(
                "h-3 w-16",
                column.align === "end" && "justify-self-end",
              )}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid min-h-14 items-center gap-4 border-b px-3 py-2 last:border-0"
            style={template}
          >
            {columns.map((column, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3",
                  column.align === "end" && "justify-end",
                )}
              >
                {column.withAvatar ? (
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                ) : null}
                <Skeleton className={cn("h-4 max-w-full", column.width)} />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
