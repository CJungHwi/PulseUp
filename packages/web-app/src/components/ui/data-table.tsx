"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    getSortedRowModel,
    ColumnFiltersState,
    getFilteredRowModel,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
}

export function DataTable<TData, TValue>({
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    return (
        <div className="flex-1 h-full overflow-hidden p-0">
            <div className="h-full overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]">
                <Table className="w-full table-fixed border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-10 shadow-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-0">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={cn(
                                                "h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r last:border-r-0",
                                                "bg-[#b9adb5] dark:bg-gray-800",
                                                "text-[#27272a] dark:text-[#94a3b8]",
                                                "border-[#343637] dark:border-[#6b7280]"
                                            )}
                                            style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : 'auto' }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={cn(
                                        "h-[35px] group border-b-0 transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                                        "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "py-0 px-2 text-xs border-r last:border-r-0 border-b-0 transition-colors",
                                                "border-[#343637] dark:border-[#6b7280]",
                                                "group-hover:text-inherit group-hover:font-inherit"
                                            )}
                                            style={{ width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : 'auto' }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="border-b-0 hover:bg-transparent">
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground border-b-0"
                                >
                                    데이터가 없습니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div >
    )
}
