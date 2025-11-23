import { Loader2 } from "lucide-react"

export function SettingsLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-600" />
      <p className="text-sm text-zinc-500 dark:text-zinc-600">加载配置中...</p>
    </div>
  )
}
