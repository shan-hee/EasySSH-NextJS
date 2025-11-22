import type { CompletionProvider, CompletionContext, CompletionItem } from "../types"

/**
 * SessionProvider - 当前会话命令补全提供者
 *
 * 数据来源: 前端内存，实时追加当前会话输入的命令
 * 优先级: 25
 */
export class SessionProvider implements CompletionProvider {
  name = "session"
  priority = 25
  enabled = true

  private sessionCommands: string[] = []
  private maxCommands = 100 // 最多保留100条会话命令

  /**
   * 添加命令到会话历史
   */
  addCommand(command: string) {
    const trimmed = command.trim()
    if (!trimmed) return

    // 去重：移除已存在的相同命令
    this.sessionCommands = this.sessionCommands.filter(cmd => cmd !== trimmed)

    // 添加到开头（最新的在前）
    this.sessionCommands.unshift(trimmed)

    // 限制数量
    if (this.sessionCommands.length > this.maxCommands) {
      this.sessionCommands = this.sessionCommands.slice(0, this.maxCommands)
    }
  }

  /**
   * 批量添加命令
   */
  addCommands(commands: string[]) {
    commands.forEach(cmd => this.addCommand(cmd))
  }

  /**
   * 清空会话历史
   */
  clear() {
    this.sessionCommands = []
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

    return this.sessionCommands
      .filter(cmd => {
        // 前缀匹配
        return cmd.toLowerCase().startsWith(currentWord.toLowerCase())
      })
      .map((cmd, index) => {
        // 计算相对优先级：最近使用的略高
        // 最近的: 25分, 较早的: 20分
        const recencyBonus = Math.max(0, 5 - Math.floor(index / 20))

        return {
          text: cmd,
          displayText: cmd,
          type: "history" as const,
          source: "local" as const,
          description: "本次会话",
          priority: this.priority + recencyBonus,
          score: this.calculateScore(cmd, currentWord, index),
          providerName: "session",
        }
      })
  }

  /**
   * 计算匹配分数
   * 考虑匹配度和使用时间（越近的分数越高）
   */
  private calculateScore(command: string, prefix: string, index: number): number {
    const cmdLower = command.toLowerCase()
    const prefixLower = prefix.toLowerCase()

    let baseScore = 0

    if (command === prefix) {
      baseScore = 100 // 精确匹配
    } else if (cmdLower.startsWith(prefixLower)) {
      baseScore = 80 // 前缀匹配
    } else if (cmdLower.includes(prefixLower)) {
      baseScore = 60 // 包含匹配
    }

    // 时效性加成：越新的命令得分越高
    const recencyBonus = Math.max(0, 20 - index)

    return baseScore + recencyBonus
  }

  /**
   * 获取会话命令数量
   */
  getCommandCount(): number {
    return this.sessionCommands.length
  }

  /**
   * 获取最近的N条命令
   */
  getRecentCommands(limit: number = 10): string[] {
    return this.sessionCommands.slice(0, limit)
  }

  /**
   * 检查命令是否在会话中
   */
  hasCommand(command: string): boolean {
    return this.sessionCommands.includes(command.trim())
  }
}
