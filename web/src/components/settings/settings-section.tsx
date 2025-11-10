"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

/**
 * 设置区块组件
 * 用于包裹设置表单的标准卡片布局
 */
export function SettingsSection({
  title,
  description,
  children,
  icon,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  )
}
