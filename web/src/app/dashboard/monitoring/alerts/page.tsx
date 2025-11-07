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

const mockAlertRules = [
 { id: 1, name: "CPU使用率过高", metric: "CPU", condition: "> 85%", duration: "5分钟", severity: "high", status: "active", servers: ["All Servers"], notifications: ["邮件", "钉钉"], lastTriggered: "2024-01-15 14:30", triggerCount: 3 },
 { id: 2, name: "内存不足", metric: "Memory", condition: "> 90%", duration: "3分钟", severity: "critical", status: "active", servers: ["Web Server 01", "Web Server 02"], notifications: ["邮件", "短信"], lastTriggered: "2024-01-15 12:15", triggerCount: 1 },
 { id: 3, name: "磁盘空间告警", metric: "Disk", condition: "> 80%", duration: "10分钟", severity: "medium", status: "active", servers: ["Database Server"], notifications: ["邮件"], lastTriggered: "从未触发", triggerCount: 0 },
 { id: 4, name: "网络流量异常", metric: "Network", condition: "> 100 MB/s", duration: "1分钟", severity: "low", status: "inactive", servers: ["All Servers"], notifications: ["钉钉"], lastTriggered: "2024-01-14 18:20", triggerCount: 12 },
]

const severityColors = {
 critical: "bg-red-100 text-red-800",
 high: "bg-orange-100 text-orange-800",
 medium: "bg-yellow-100 text-yellow-800",
 low: "bg-blue-100 text-blue-800",
}

export default function MonitoringAlertsPage() {
 const [rules] = useState(mockAlertRules)
 const [searchTerm, setSearchTerm] = useState("")

 return (
 <>
 <PageHeader title="告警规则">
 <Button><Plus className="mr-2 h-4 w-4" />新建规则</Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">告警规则</CardTitle>
 <Bell className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{rules.length}</div>
 <p className="text-xs text-muted-foreground">启用: {rules.filter(r => r.status === "active").length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">今日触发</CardTitle>
 <AlertTriangle className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-red-600">16</div>
 <p className="text-xs text-muted-foreground">已发送通知</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">高级别告警</CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-orange-600">
 {rules.filter(r => r.severity === "critical" || r.severity === "high").length}
 </div>
 <p className="text-xs text-muted-foreground">需要关注</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">告警准确率</CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">92%</div>
 <p className="text-xs text-muted-foreground">本周平均</p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">筛选器</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input placeholder="搜索规则名称..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">告警规则列表</CardTitle>
 <CardDescription>共 {rules.length} 条规则</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>规则名称</TableHead>
 <TableHead>监控指标</TableHead>
 <TableHead>触发条件</TableHead>
 <TableHead>持续时长</TableHead>
 <TableHead>严重程度</TableHead>
 <TableHead>状态</TableHead>
 <TableHead>触发次数</TableHead>
 <TableHead>操作</TableHead>
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
 {rule.severity === "critical" ? "紧急" : rule.severity === "high" ? "高" : rule.severity === "medium" ? "中" : "低"}
 </Badge>
 </TableCell>
 <TableCell>
 <Badge className={rule.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {rule.status === "active" ? "启用" : "禁用"}
 </Badge>
 </TableCell>
 <TableCell className="font-mono">{rule.triggerCount}</TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />编辑</DropdownMenuItem>
 <DropdownMenuItem>{rule.status === "active" ? <><BellOff className="mr-2 h-4 w-4" />禁用</> : <><Bell className="mr-2 h-4 w-4" />启用</>}</DropdownMenuItem>
 <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />删除</DropdownMenuItem>
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
