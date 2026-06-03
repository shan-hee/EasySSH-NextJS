import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Code2, ArrowUpDown, ArrowUp, ArrowDown, Play, Edit, Trash2, User, CalendarClock, Hash, MoreHorizontal } from "lucide-react"
import { type Script } from "@/lib/api"
import { formatTimestamp } from "@/components/ui/data-table"
import { cn } from "@/lib/utils"

interface Handlers {
  onExecute: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  selectedId?: string | null
  t: (key: string) => string
}

export function createScriptColumns({
  onExecute,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
  t,
}: Handlers): ColumnDef<Script>[] {
  const columns: ColumnDef<Script>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            {t("colName")}
          </div>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const script = row.original
        const primaryTag = script.tags?.[0]
        return (
          <button
            type="button"
            onClick={() => onSelect?.(script.id)}
            className={cn(
              "flex min-w-[200px] max-w-[340px] items-start gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent/60",
              selectedId === script.id && "bg-accent text-accent-foreground"
            )}
          >
            <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{script.name}</span>
                {primaryTag && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {primaryTag}
                  </Badge>
                )}
              </div>
              {script.description && (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {script.description}
                </p>
              )}
            </div>
          </button>
        )
      },
      filterFn: (row, id, value) => {
        const keyword = ((value as string) || "").toLowerCase()
        if (!keyword) return true
        const s = row.original
        return (
          s.name.toLowerCase().includes(keyword) ||
          (s.description || "").toLowerCase().includes(keyword)
        )
      },
    },
    {
      id: "description",
      accessorKey: "description",
      header: t("colDescription"),
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[240px] text-xs text-muted-foreground">
          {row.original.description || "-"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "content",
      accessorKey: "content",
      header: t("colContent"),
      cell: ({ row }) => (
        <div className="max-w-[320px] rounded-md bg-muted px-3 py-2">
          <pre className="line-clamp-2 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {row.original.content}
          </pre>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: t("colTags"),
      cell: ({ row }) => {
        const tags = row.original.tags || []
        return (
          <div className="flex max-w-[150px] flex-wrap gap-1">
            {tags.length === 0 ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : (
              <>
                {tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 2 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{tags.length - 2}
                  </Badge>
                )}
              </>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => {
        const selected = (value as string[]) || []
        if (selected.length === 0) return true
        const tags = (row.getValue(id) as string[]) || []
        return selected.some((v) => tags.includes(v))
      },
    },
    {
      id: "author",
      accessorKey: "author",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("colAuthor")}
          </div>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span className="block max-w-[96px] truncate text-sm text-muted-foreground">{row.original.author || "-"}</span>
      ),
      filterFn: (row, id, value) => {
        const selected = (value as string[]) || []
        if (selected.length === 0) return true
        return selected.includes(row.getValue(id) as string)
      },
    },
    {
      id: "updated_at",
      accessorKey: "updated_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            {t("colUpdatedAt")}
          </div>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const ts = row.original.updated_at
        const { date, time } = formatTimestamp(ts)
        return (
          <div className="whitespace-nowrap text-sm text-muted-foreground">
            <div>{time}</div>
            <div className="text-xs">{date}</div>
          </div>
        )
      },
    },
    {
      id: "executions",
      accessorKey: "executions",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {t("colExecutions")}
          </div>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.executions || 0}</span>
      ),
    },
    {
      id: "actions",
      header: t("colActions"),
      cell: ({ row }) => {
        const script = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title={t("actionExecuteTitle")}
              onClick={() => onExecute(script.id)}
            >
              <Play className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t("colActions")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(script.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("actionEdit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(script.id)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actionDelete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableSorting: false,
    },
  ]

  return columns
}
