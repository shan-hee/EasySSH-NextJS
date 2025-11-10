"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface TabConfig {
  value: string
  label: string
  icon?: LucideIcon
  component: React.ComponentType<any>
}

interface SettingsTabsProps {
  tabs: TabConfig[]
  defaultTab?: string
  className?: string
}

/**
 * 设置标签页组件
 * 统一的标签页布局，支持图标和响应式设计
 */
export function SettingsTabs({
  tabs,
  defaultTab,
  className,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = React.useState(
    defaultTab || tabs[0]?.value || ""
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn("space-y-4", className)}
    >
      <TabsList className={cn("grid w-full", `grid-cols-${tabs.length}`)}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon && (
              <tab.icon className="mr-2 h-4 w-4" />
            )}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-4">
          <tab.component />
        </TabsContent>
      ))}
    </Tabs>
  )
}
