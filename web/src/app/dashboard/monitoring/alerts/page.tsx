"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Bell, BellOff, Edit, Trash2, AlertTriangle, TrendingUp } from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

const mockAlertRules = [
 { id: 1, name: "CPU usage high", metric: "CPU", condition: "> 85%", duration: "5m", severity: "high", status: "active", servers: ["All Servers"], notifications: ["Email"], lastTriggered: "2024-01-15 14:30", triggerCount: 3 },
 { id: 2, name: "Memory usage high", metric: "Memory", condition: "> 90%", duration: "3m", severity: "critical", status: "active", servers: ["Web Server 01", "Web Server 02"], notifications: ["Email", "SMS"], lastTriggered: "2024-01-15 12:15", triggerCount: 1 },
 { id: 3, name: "Disk space alert", metric: "Disk", condition: "> 80%", duration: "10m", severity: "medium", status: "active", servers: ["Database Server"], notifications: ["Email"], lastTriggered: "Never", triggerCount: 0 },
 { id: 4, name: "Network traffic anomaly", metric: "Network", condition: "> 100 MB/s", duration: "1m", severity: "low", status: "inactive", servers: ["All Servers"], notifications: ["Webhook"], lastTriggered: "2024-01-14 18:20", triggerCount: 12 },
]

const severityColors = {
 critical: "bg-red-100 text-red-800",
 high: "bg-orange-100 text-orange-800",
 medium: "bg-yellow-100 text-yellow-800",
 low: "bg-blue-100 text-blue-800",
}

export default function MonitoringAlertsPage() {
 const { ready } = useAuthReady()
 const t = useTranslations("monitoringAlerts")
 const [rules] = useState(mockAlertRules)
 const [searchTerm, setSearchTerm] = useState("")

 if (!ready) {
   // 等待认证就绪后再展示告警规则（后续会接入后端）
   return null
 }

 return (
 <>
 <PageHeader title={t("pageTitle")} />

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsRulesTitle")}</CardTitle>
 <Bell className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
        <CardContent>
        <div className="text-2xl font-bold">{rules.length}</div>
        <p className="text-xs text-muted-foreground">
        {t("statsRulesEnabled", {
        enabled: rules.filter(r => r.status === "active").length,
        })}
        </p>
        </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsTodayTriggeredTitle")}</CardTitle>
 <AlertTriangle className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-red-600">16</div>
 <p className="text-xs text-muted-foreground">{t("statsTodayTriggeredDesc")}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsHighSeverityTitle")}</CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-orange-600">
 {rules.filter(r => r.severity === "critical" || r.severity === "high").length}
 </div>
 <p className="text-xs text-muted-foreground">{t("statsHighSeverityDesc")}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsAccuracyTitle")}</CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">92%</div>
 <p className="text-xs text-muted-foreground">{t("statsAccuracyDesc")}</p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">{t("filterTitle")}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("filterSearchPlaceholder")}
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 </CardContent>
 </Card>

 <Card>
   <CardHeader className="flex flex-row items-center justify-between">
   <div>
     <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
     <CardDescription>
       {t("tableDescription", { total: rules.length })}
     </CardDescription>
   </div>
   <Button size="sm">
     <Plus className="mr-2 h-4 w-4" />
     {t("newRule")}
   </Button>
   </CardHeader>
 <CardContent>
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>{t("colName")}</TableHead>
 <TableHead>{t("colMetric")}</TableHead>
 <TableHead>{t("colCondition")}</TableHead>
 <TableHead>{t("colDuration")}</TableHead>
 <TableHead>{t("colSeverity")}</TableHead>
 <TableHead>{t("colStatus")}</TableHead>
 <TableHead>{t("colTriggerCount")}</TableHead>
 <TableHead>{t("colActions")}</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {rules.map(rule => (
 <TableRow key={rule.id}>
 <TableCell className="font-medium">{rule.name}</TableCell>
 <TableCell><Badge variant="outline">{rule.metric}</Badge></TableCell>
 <TableCell className="font-mono text-sm">{rule.condition}</TableCell>
 <TableCell>{rule.duration}</TableCell>
 <TableCell>
 <Badge className={severityColors[rule.severity as keyof typeof severityColors]}>
 {rule.severity === "critical"
   ? t("severityCritical")
   : rule.severity === "high"
   ? t("severityHigh")
   : rule.severity === "medium"
   ? t("severityMedium")
   : t("severityLow")}
 </Badge>
 </TableCell>
 <TableCell>
 <Badge className={rule.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {rule.status === "active" ? t("statusActive") : t("statusInactive")}
 </Badge>
 </TableCell>
 <TableCell className="font-mono">{rule.triggerCount}</TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem>
   <Edit className="mr-2 h-4 w-4" />
   {t("actionEdit")}
 </DropdownMenuItem>
 <DropdownMenuItem>
   {rule.status === "active" ? (
     <>
       <BellOff className="mr-2 h-4 w-4" />
       {t("actionDisable")}
     </>
   ) : (
     <>
       <Bell className="mr-2 h-4 w-4" />
       {t("actionEnable")}
     </>
   )}
 </DropdownMenuItem>
 <DropdownMenuItem className="text-red-600">
   <Trash2 className="mr-2 h-4 w-4" />
   {t("actionDelete")}
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 )
}
