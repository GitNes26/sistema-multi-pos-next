"use client"

import * as React from "react"
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  RefreshCw,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/base/spinner"
import { InputGroupField } from "./input-group-field"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  pageSizeOptions?: number[]
  enableSelection?: boolean
  rowKey?: (row: TData) => string
  onSelectedRowsChange?: (rows: TData[]) => void
  onRowClick?: (row: TData) => void
  loading?: boolean
  emptyMessage?: string
  showPagination?: boolean
  showColumnVisibility?: boolean
  toolbarSlot?: React.ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  renderCard?: (row: TData) => React.ReactNode
  className?: string
  tableClassName?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Buscar…",
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  enableSelection = false,
  rowKey,
  onSelectedRowsChange,
  onRowClick,
  loading = false,
  emptyMessage = "Sin resultados",
  showPagination = true,
  showColumnVisibility = true,
  toolbarSlot,
  onRefresh,
  refreshing = false,
  renderCard,
  className,
  tableClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "select",
      size: 28,
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Seleccionar todo"
          className="size-4 rounded-sm accent-primary"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Seleccionar fila"
          className="size-4 rounded-sm accent-primary"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }),
    []
  )

  const allColumns = React.useMemo(() => {
    if (!enableSelection) return columns
    const hasSelect = columns.some((c) => "id" in c && c.id === "select")
    return hasSelect ? columns : [selectionColumn, ...columns]
  }, [columns, enableSelection, selectionColumn])

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: enableSelection,
    getRowId: rowKey ? (row) => rowKey(row) : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  })

  const selectedRows = React.useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowSelection, data]
  )

  React.useEffect(() => {
    if (onSelectedRowsChange) onSelectedRowsChange(selectedRows)
  }, [selectedRows, onSelectedRowsChange])

  const pageCount = table.getPageCount()

  function renderCards() {
    const visibleRows = table.getRowModel().rows
    if (visibleRows.length === 0) return <RowEmpty message={emptyMessage} />
    return (
      <div className="space-y-2">
        {visibleRows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border bg-card p-3"
            onClick={() => onRowClick?.(row.original)}
          >
            {renderCard ? renderCard(row.original) : defaultCard(row)}
          </div>
        ))}
      </div>
    )
  }

  function defaultCard(row: Row<TData>) {
    const cells = row.getVisibleCells().filter((c) => c.column.id !== "select")
    return (
      <div className="flex flex-col gap-1.5">
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="truncate text-xs font-medium text-muted-foreground">
              {headerLabel(cell.column)}
            </span>
            <span className="truncate text-sm">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {(searchable || showColumnVisibility || toolbarSlot || onRefresh) && (
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onRefresh}
                    aria-label="Refrescar"
                  >
                    <RefreshCw
                      className={cn("size-4", refreshing && "animate-spin")}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refrescar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {searchable && (
            <InputGroupField
              type="search"
              placeholder={searchPlaceholder}
              leftIcon={<Search className="size-4" />}
              className="w-full max-w-56"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          )}
          {toolbarSlot}
          <div className="ml-auto flex items-center gap-2">
            {showColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <EyeOff className="size-4" />
                    Columnas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => column.toggleVisibility(v)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {String(headerLabel(column))}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className="hidden md:block">
        <div className="rounded-lg border">
          <Table className={tableClassName}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            header.column.getCanSort() &&
                              "cursor-pointer select-none"
                          )}
                          onClick={
                            header.column.getCanSort()
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <SortIcon sorted={header.column.getIsSorted()} />
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={allColumns.length}
                    className="h-32 text-center"
                  >
                    <Spinner className="mx-auto size-6" />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={allColumns.length}
                    className="h-32 text-center"
                  >
                    <RowEmpty message={emptyMessage} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="md:hidden">{renderCards()}</div>

      {showPagination && !loading && pageCount > 1 && (
        <PaginationFooter table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  )
}

function headerLabel<TData, TValue = unknown>(
  column: Column<TData, TValue>
): string {
  const h = column.columnDef.header
  if (typeof h === "string") return h
  return column.id
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5 text-primary" />
  if (sorted === "desc") return <ArrowDown className="size-3.5 text-primary" />
  return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />
}

function RowEmpty({ message }: { message: string }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {message}
    </Badge>
  )
}

function PaginationFooter<TData>({
  table,
  pageSizeOptions,
}: {
  table: ReturnType<typeof useReactTable<TData>>
  pageSizeOptions: number[]
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Filas por página</span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger className="h-7 w-16 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}
          –
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          de {table.getFilteredRowModel().rows.length}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
