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

export type DataTableColumn<TData> = {
  key: string;
  header: ReactNode;
  cell: (row: TData) => ReactNode;
  className?: string;
};

export type DataTableProps<TData> = {
  columns: Array<DataTableColumn<TData>>;
  data: TData[];
  emptyState?: ReactNode;
  onRowClick?: (row: TData) => void;
  /** Stable identity per row; falls back to the index. */
  getRowId?: (row: TData, index: number) => string;
};

export function DataTable<TData>({
  columns,
  data,
  emptyState,
  onRowClick,
  getRowId,
}: DataTableProps<TData>) {
  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    row: TData,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    }
  }

  if (data.length === 0 && emptyState !== undefined) {
    return <>{emptyState}</>;
  }

  return (
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
            key={getRowId ? getRowId(row, rowIndex) : rowIndex}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={cn(
              onRowClick &&
                "focus-visible:outline-ring focus-visible:bg-muted/50 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2",
            )}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick ? (event) => handleRowKeyDown(event, row) : undefined
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
}
