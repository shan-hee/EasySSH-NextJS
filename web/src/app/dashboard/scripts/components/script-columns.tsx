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
import { Code2, ArrowUpDown, ArrowUp, ArrowDown, Play, Edit, Trash2, User, CalendarClock, Hash } from "lucide-react"
import { type Script } from "@/lib/api"
import { formatTimestamp } from "@/components/ui/data-table"

interface Handlers {
  onExecute: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function createScriptColumns({ onExecute, onEdit, onDelete }: Handlers): ColumnDef<Script>[] {
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
            脚本名称
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
        return (
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{script.name}</span>
          </div>
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
      header: "描述",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.original.description}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "content",
      accessorKey: "content",
      header: "脚本内容",
      cell: ({ row }) => (
        <div className="bg-muted rounded-md px-3 py-2 max-w-[420px]">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {row.original.content}
          </pre>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: "标签",
      cell: ({ row }) => {
        const tags = row.original.tags || []
        return (
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))
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
            作者
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
        <span className="text-sm text-muted-foreground">{row.original.author}</span>
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
            更新时间
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
          <div className="text-sm text-muted-foreground">
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
            执行次数
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
        <span className="text-sm">{row.original.executions}</span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const script = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="执行脚本"
              onClick={() => onExecute(script.id)}
            >
              <Play className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ArrowDown className="h-4 w-4 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(script.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(script.id)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
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
