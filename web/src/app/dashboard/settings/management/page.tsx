"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Database } from "lucide-react"
import { UserManagementContent } from "./_tabs/user-management-content"
import { BackupRestoreTab } from "./_tabs/backup-restore-tab"

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState("users")

  return (
    <>
      <PageHeader title="管理运维" />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="backup">
              <Database className="mr-2 h-4 w-4" />
              备份恢复
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="flex-1 min-h-0">
            <UserManagementContent />
          </TabsContent>

          <TabsContent value="backup" className="flex-1 min-h-0">
            <BackupRestoreTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
