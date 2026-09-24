"use client";

import type { KeyboardEvent, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

/**
 * Where a column lands on the phone card. Columns without a role stay
 * table-only; a table with no roles at all keeps rendering as a table on
 * every viewport.
 *
 * - `title`: first line, the row's identity.
 * - `subtitle`: second line, muted.
 * - `meta`: small facts joined with a middle dot under the subtitle.
 * - `trailing`: right-aligned figure on the title line (amount, count).
 * - `status`: badge under the trailing figure.
 * - `actions`: row menu, kept outside the tappable area.
 */
export type DataTableMobileRole =
  "title" | "subtitle" | "meta" | "trailing" | "status" | "actions";

export type DataTableColumn<TData> = {
  key: string;
  header: ReactNode;
  cell: (row: TData) => ReactNode;
  className?: string;
  mobile?: DataTableMobileRole;
  /** Card-specific rendering; falls back to `cell`. */
  mobileCell?: (row: TData) => ReactNode;
};

export type DataTableProps<TData> = {
  columns: Array<DataTableColumn<TData>>;
  data: TData[];
  emptyState?: ReactNode;
  onRowClick?: (row: TData) => void;
  /** Stable identity per row; falls back to the index. */
  getRowId?: (row: TData, index: number) => string;
};

function isActivation(event: KeyboardEvent<HTMLElement>) {
  return event.key === "Enter" || event.key === " ";
}

export function DataTable<TData>({
  columns,
  data,
  emptyState,
  onRowClick,
  getRowId,
}: DataTableProps<TData>) {
  const hasCards = columns.some((column) => column.mobile !== undefined);
  const byRole = (role: DataTableMobileRole) =>
    columns.filter((column) => column.mobile === role);
  const rowId = (row: TData, index: number) =>
    getRowId ? getRowId(row, index) : String(index);
  const cardCell = (column: DataTableColumn<TData>, row: TData) =>
    column.mobileCell ? column.mobileCell(row) : column.cell(row);

  if (data.length === 0 && emptyState !== undefined) {
    return <>{emptyState}</>;
  }

  const clickableClass =
    onRowClick &&
    "focus-visible:outline-ring focus-visible:bg-canvas-soft active:bg-canvas-soft-2 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2";

  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow
            key={rowId(row, rowIndex)}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={cn(clickableClass)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (isActivation(event)) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!hasCards) {
    return table;
  }

  const titleColumns = byRole("title");
  const subtitleColumns = byRole("subtitle");
  const metaColumns = byRole("meta");
  const trailingColumns = byRole("trailing");
  const statusColumns = byRole("status");
  const actionColumns = byRole("actions");

  const cards = (
    <ul data-slot="data-cards" className="divide-hairline divide-y">
      {data.map((row, rowIndex) => {
        const meta = metaColumns
          .map((column) => ({ key: column.key, node: cardCell(column, row) }))
          .filter((item) => item.node !== null && item.node !== undefined);

        return (
          <li
            key={rowId(row, rowIndex)}
            className="relative flex items-start gap-3"
          >
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-4 outline-none",
                actionColumns.length === 0 && "pr-4",
                onRowClick &&
                  "focus-visible:outline-ring active:bg-canvas-soft-2 cursor-pointer transition-[background-color] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (isActivation(event)) {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {titleColumns.map((column) => (
                  <div
                    key={column.key}
                    className="text-copy min-w-0 leading-snug font-medium [&_.truncate]:whitespace-normal"
                  >
                    {cardCell(column, row)}
                  </div>
                ))}
                {subtitleColumns.map((column) => (
                  <div
                    key={column.key}
                    className="text-muted-foreground text-copy-sm min-w-0"
                  >
                    {cardCell(column, row)}
                  </div>
                ))}
                {meta.length > 0 ? (
                  <div className="text-muted-foreground text-copy-sm flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {meta.map((item, index) => (
                      <span
                        key={item.key}
                        className="inline-flex min-w-0 items-center gap-1.5"
                      >
                        {index > 0 ? (
                          <span aria-hidden="true" className="opacity-60">
                            ·
                          </span>
                        ) : null}
                        {item.node}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {trailingColumns.length > 0 || statusColumns.length > 0 ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                  {trailingColumns.map((column) => (
                    <div
                      key={column.key}
                      className="text-copy leading-snug font-medium"
                    >
                      {cardCell(column, row)}
                    </div>
                  ))}
                  {statusColumns.map((column) => (
                    <div key={column.key}>{cardCell(column, row)}</div>
                  ))}
                </div>
              ) : null}
            </div>
            {actionColumns.length > 0 ? (
              <div
                className="flex shrink-0 items-center self-center pr-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {actionColumns.map((column) => (
                  <div key={column.key}>{cardCell(column, row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className="sm:hidden">{cards}</div>
      <div className="hidden sm:block">{table}</div>
    </>
  );
}
