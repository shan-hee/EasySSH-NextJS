"use client"

import { startTransition } from "react"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { cn } from "@/lib/utils"

export type SftpFileTableSortKey = "name" | "size" | "modified"
export type SftpFileTableSortOrder = "asc" | "desc"

export interface SftpFileTableHeaderProps {
  sortBy: SftpFileTableSortKey
  sortOrder: SftpFileTableSortOrder
  onSort: (key: SftpFileTableSortKey) => void
}

export function SftpFileTableHeader({
  sortBy,
  sortOrder,
  onSort,
}: SftpFileTableHeaderProps) {
  const tSftp = useWorkspaceSftpTranslator()
  const stickyHeaderCellClass = "sticky top-0 z-20 bg-table-header supports-[backdrop-filter]:backdrop-blur-sm shadow-sm"

  const renderSortMark = (key: SftpFileTableSortKey) => {
    return sortBy === key ? (sortOrder === "asc" ? "↑" : "↓") : null
  }

  const handleSort = (key: SftpFileTableSortKey) => {
    startTransition(() => {
      onSort(key)
    })
  }

  return (
    <TableHeader className="sticky top-0 z-20 bg-table-header supports-[backdrop-filter]:backdrop-blur-sm shadow-sm">
      <TableRow className={cn(
        "border-b border-border text-xs",
      )}>
        <TableHead
          className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
          onClick={() => handleSort("name")}
        >
          {tSftp("columnName")} {renderSortMark("name")}
        </TableHead>
        <TableHead
          className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
          onClick={() => handleSort("size")}
        >
          {tSftp("columnSize")} {renderSortMark("size")}
        </TableHead>
        <TableHead
          className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
          onClick={() => handleSort("modified")}
        >
          {tSftp("columnModified")} {renderSortMark("modified")}
        </TableHead>
        <TableHead className={cn(stickyHeaderCellClass)}>
          {tSftp("columnPermissions")}
        </TableHead>
        <TableHead className={cn(stickyHeaderCellClass, "text-right")}>
          {tSftp("columnActions")}
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}
