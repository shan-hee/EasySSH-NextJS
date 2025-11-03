import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface LogStatsCardProps {
  title: string
  value: number | string
  description?: string
  icon: LucideIcon
  valueColor?: string
}

export function LogStatsCard({
  title,
  value,
  description,
  icon: Icon,
  valueColor = "text-2xl font-bold"
}: LogStatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={valueColor}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}