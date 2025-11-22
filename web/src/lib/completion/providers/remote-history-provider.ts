import type { CompletionProvider, CompletionContext, CompletionItem } from "../types"

/**
 * RemoteHistoryProvider - 远端历史命令补全提供者
 *
 * 数据来源: 远端服务器历史文件 (bash/zsh/fish)
 * 优先级: 35-45 (动态，最新命令优先级最高)
 */
export class RemoteHistoryProvider implements CompletionProvider {
  name = "remote-history"
  priority = 40 // 平均优先级
  enabled = true

  private historyCache: string[] = []
  private timestamp: number = 0

  /**
   * 加载远端历史命令
   */
  loadHistory(commands: string[], timestamp?: number) {
    this.historyCache = commands
    this.timestamp = timestamp || Date.now()
  }

  /**
   * 清空历史缓存
   */
  clear() {
    this.historyCache = []
    this.timestamp = 0
  }

  /**
   * 增量更新：添加新命令到历史开头
   */
  addCommand(command: string) {
    if (!command.trim()) return

    // 去重：移除已存在的相同命令
    this.historyCache = this.historyCache.filter(cmd => cmd !== command)

    // 添加到开头
    this.historyCache.unshift(command)

    // 限制缓存大小（最多保留500条）
    if (this.historyCache.length > 500) {
      this.historyCache = this.historyCache.slice(0, 500)
    }
  }

  /**
   * 获取补全项
   */
  async getCompletions(context: CompletionContext): Promise<CompletionItem[]> {
    const { currentWord } = context

    // 如果当前词为空，不提供补全
    if (!currentWord) {
      return []
    }

    return this.historyCache
      .filter(cmd => {
        // 前缀匹配
        return cmd.toLowerCase().startsWith(currentWord.toLowerCase())
      })
      .map((cmd, index) => {
        // 动态优先级：最新的命令优先级最高
        // 第1条: 45分, 第250条: 40分, 第500条: 35分
        const totalCommands = this.historyCache.length
        const dynamicPriority = 35 + Math.floor((totalCommands - index) / totalCommands * 10)

        return {
          text: cmd,
          displayText: cmd,
          type: "history" as const,
          source: "remote" as const,
          description: "远端历史命令",
          priority: dynamicPriority,
          score: this.calculateScore(cmd, currentWord),
          providerName: "remote-history",
        }
      })
  }

  /**
   * 计算匹配分数
   * 精确匹配 > 前缀匹配 > 包含匹配
   */
  private calculateScore(command: string, prefix: string): number {
    const cmdLower = command.toLowerCase()
    const prefixLower = prefix.toLowerCase()

    if (command === prefix) return 100 // 精确匹配
    if (cmdLower.startsWith(prefixLower)) return 80 // 前缀匹配
    if (cmdLower.includes(prefixLower)) return 60 // 包含匹配

    return 0
  }

  /**
   * 获取缓存的历史数量
   */
  getHistoryCount(): number {
    return this.historyCache.length
  }

  /**
   * 获取数据时间戳
   */
  getTimestamp(): number {
    return this.timestamp
  }
}
