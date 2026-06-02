"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

/**
 * 快速操作组件（客户端组件）
 * 提供常用功能的快速入口
 */
export function QuickActions() {
  const t = useTranslations("dashboard")

  return (
    <div className="bg-card border rounded-xl p-6 flex-1">
      <h3 className="text-xl font-semibold mb-4">{t("quickActions")}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/terminal">
          <button className="bg-primary text-primary-foreground p-4 rounded-lg hover:bg-primary/90 transition-colors w-full">
            <div className="text-center">
              <div className="text-2xl mb-2">🖥️</div>
              <div>{t("quickAddServer")}</div>
            </div>
          </button>
        </Link>
        <Link href="/dashboard/terminal">
          <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
            <div className="text-center">
              <div className="text-2xl mb-2">💻</div>
              <div>{t("quickWebTerminal")}</div>
            </div>
          </button>
        </Link>
        <Link href="/dashboard/monitoring">
          <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <div>{t("quickViewMonitoring")}</div>
            </div>
          </button>
        </Link>
        <Link href="/dashboard/settings?section=basic">
          <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
            <div className="text-center">
              <div className="text-2xl mb-2">⚙️</div>
              <div>{t("quickSystemSettings")}</div>
            </div>
          </button>
        </Link>
      </div>
    </div>
  )
}
