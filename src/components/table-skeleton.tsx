import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export type TableSkeletonProps = {
  /** Column count of the real table, so the grid lines up on swap. */
  columns: number;
  rows?: number;
  /**
   * Announced to assistive tech while loading. Omit it inside a route
   * `loading.tsx` whose wrapper already carries `aria-busy`.
   */
  label?: string;
};

// Deterministic widths: varied enough to read as text, stable across renders.
const CELL_WIDTHS = ["w-14", "w-40", "w-24", "w-28", "w-20", "w-16"] as const;

/**
 * Loading state shaped like `DataTable`: same header height, row height and
 * column count, so nothing shifts when data arrives.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  label,
}: TableSkeletonProps) {
  const columnIndexes = Array.from({ length: columns }, (_, index) => index);

  return (
    <div role={label ? "status" : undefined} aria-busy="true">
      {label ? <span className="sr-only">{label}</span> : null}
      <Table aria-hidden="true">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columnIndexes.map((column) => (
              <TableHead key={column}>
                <Skeleton className="h-3.5 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              {columnIndexes.map((column) => (
                <TableCell key={column} className="h-12">
                  <Skeleton
                    className={`h-4 ${CELL_WIDTHS[(column + row) % CELL_WIDTHS.length]}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
