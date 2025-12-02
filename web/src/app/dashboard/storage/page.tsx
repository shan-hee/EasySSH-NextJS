"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HardDrive, Trash2, FolderOpen, File, AlertCircle, Database } from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

const mockStorageData = [
 {
 id: 1,
 name: "temp",
 path: "/tmp/easyssh/",
 size: "2.3 GB",
 fileCount: 145,
 type: "temp",
 lastModified: "2024-01-15 14:30",
 canClean: true
 },
 {
 id: 2,
 name: "cache",
 path: "/var/easyssh/uploads/",
 size: "5.8 GB",
 fileCount: 328,
 type: "cache",
 lastModified: "2024-01-15 13:45",
 canClean: true
 },
 {
 id: 3,
 name: "logs",
 path: "/var/log/easyssh/",
 size: "1.2 GB",
 fileCount: 892,
 type: "logs",
 lastModified: "2024-01-15 14:35",
 canClean: true
 },
 {
 id: 4,
 name: "recordings",
 path: "/var/easyssh/recordings/",
 size: "15.6 GB",
 fileCount: 67,
 type: "recordings",
 lastModified: "2024-01-15 12:20",
 canClean: false
 },
 {
 id: 5,
 name: "backups",
 path: "/var/backups/easyssh/",
 size: "8.9 GB",
 fileCount: 23,
 type: "backups",
 lastModified: "2024-01-14 02:00",
 canClean: false
 },
]

const typeColors = {
 temp: "bg-yellow-100 text-yellow-800",
 cache: "bg-blue-100 text-blue-800",
 logs: "bg-purple-100 text-purple-800",
 recordings: "bg-green-100 text-green-800",
 backups: "bg-red-100 text-red-800",
}

const typeLabels: Record<string, keyof typeof typeColors> = {
 temp: "temp",
 cache: "cache",
 logs: "logs",
 recordings: "recordings",
 backups: "backups",
}

export default function StoragePage() {
 const { ready } = useAuthReady()
 const t = useTranslations("storage")
 const [storage] = useState(mockStorageData)

 const totalSize = storage.reduce((acc, item) => {
 const size = parseFloat(item.size)
 return acc + size
 }, 0)

 const cleanableSize = storage
 .filter(item => item.canClean)
 .reduce((acc, item) => acc + parseFloat(item.size), 0)

 if (!ready) {
   // 等待认证就绪时先不渲染具体内容，保持与其他 Dashboard 页一致
   return null
 }

 return (
 <>
 <PageHeader title={t("pageTitle")}>
 <Button variant="destructive" size="sm">
 <Trash2 className="mr-2 h-4 w-4" />
 {t("actionClean")}
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsTotalTitle")}</CardTitle>
 <HardDrive className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{totalSize.toFixed(1)} GB</div>
 <p className="text-xs text-muted-foreground">{t("statsTotalDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsCleanableTitle")}</CardTitle>
 <Trash2 className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-orange-600">{cleanableSize.toFixed(1)} GB</div>
 <p className="text-xs text-muted-foreground">{t("statsCleanableDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsFileCountTitle")}</CardTitle>
 <File className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {storage.reduce((acc, item) => acc + item.fileCount, 0)}
 </div>
 <p className="text-xs text-muted-foreground">{t("statsFileCountDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsDiskUsageTitle")}</CardTitle>
 <Database className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
           <CardContent>
           <div className="text-2xl font-bold text-green-600">42%</div>
           <p className="text-xs text-muted-foreground">
           {t("statsDiskUsageDesc", { free: "58 GB" })}
           </p>
           </CardContent>
 </Card>
 </div>

 <Card>
         <CardHeader>
         <div className="flex items-center justify-between">
         <div>
         <CardTitle>{t("chartTitle")}</CardTitle>
         <CardDescription>{t("chartDesc", { total: "100 GB" })}</CardDescription>
         </div>
         </div>
         </CardHeader>
 <CardContent>
 <div className="space-y-2">
 <div className="h-8 bg-gray-200 rounded-lg overflow-hidden flex">
 <div className="bg-yellow-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "23%"}}>
 {t("typeTempShort")} 2.3GB
 </div>
 <div className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "58%"}}>
 {t("typeCacheShort")} 5.8GB
 </div>
 <div className="bg-purple-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "12%"}}>
 {t("typeLogsShort")} 1.2GB
 </div>
 <div className="bg-green-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "156%"}}>
 {t("typeRecordingsShort")} 15.6GB
 </div>
 <div className="bg-red-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "89%"}}>
 {t("typeBackupsShort")} 8.9GB
 </div>
 </div>
         <div className="flex items-center justify-between text-sm text-muted-foreground">
         <span>
         {t("chartUsedLabel", {
         used: `${totalSize.toFixed(1)} GB`,
         percent: "42%",
         })}
         </span>
         <span>{t("chartFreeLabel", { free: "58 GB" })}</span>
         </div>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4">
 {storage.map(item => (
 <Card key={item.id}>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
 <FolderOpen className="h-6 w-6 text-gray-600" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-medium">
   {t(
     item.name === "temp"
       ? "typeTempName"
       : item.name === "cache"
       ? "typeCacheName"
       : item.name === "logs"
       ? "typeLogsName"
       : item.name === "recordings"
       ? "typeRecordingsName"
       : "typeBackupsName",
   )}
 </h3>
 <Badge className={typeColors[item.type as keyof typeof typeColors]}>
   {t(
     item.type === "temp"
       ? "typeTempShort"
       : item.type === "cache"
       ? "typeCacheShort"
       : item.type === "logs"
       ? "typeLogsShort"
       : item.type === "recordings"
       ? "typeRecordingsShort"
       : "typeBackupsShort",
   )}
 </Badge>
 {item.canClean && (
 <Badge variant="outline" className="text-xs">{t("badgeCleanable")}</Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground">{item.path}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("lastModified", { time: item.lastModified })}
        </p>
 </div>
 </div>
 <div className="text-right space-y-2">
 <div>
 <div className="text-2xl font-bold">{item.size}</div>
        <div className="text-sm text-muted-foreground">
          {t("fileCount", { count: item.fileCount })}
        </div>
 </div>
 {item.canClean && (
 <Button variant="outline" size="sm">
 <Trash2 className="mr-2 h-4 w-4" />
 {t("itemClean")}
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

<Card className="border-yellow-200 bg-yellow-50">
 <CardContent className="pt-6">
 <div className="flex items-start gap-3">
 <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
 <div>
 <h4 className="font-medium text-yellow-900">{t("hintTitle")}</h4>
 <p className="text-sm text-yellow-800 mt-1">
   {t("hintContent")}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 )
}
