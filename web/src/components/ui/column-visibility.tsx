import React from "react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Settings2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface ColumnVisibilityProps {
  columns: Array<{
    id: string
    label: string
    visible: boolean
    onToggle: () => void
  }>
}

export function ColumnVisibility({ columns }: ColumnVisibilityProps) {
  const tCommon = useTranslations("common")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="h-4 w-4" />
          {tCommon("tableColumns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>{tCommon("tableColumnsLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            className="capitalize cursor-pointer"
            checked={column.visible}
            onCheckedChange={column.onToggle}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
