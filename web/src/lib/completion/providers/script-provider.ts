import type { CompletionProvider, CompletionContext, CompletionItem } from "../types"
import { matchesCommandWithPrefix } from "../utils"

/**
 * 脚本项接口（来自服务器）
 */
export interface ScriptItem {
  name: string        // 脚本名称（用于显示）
  content: string     // 脚本内容（实际命令，用于补全匹配）
  description: string
  executions: number
  tags: string[]
}

/**
 * ScriptProvider - 脚本库补全提供者
 *
 * 数据来源: 数据库 scripts 表
 * 优先级: 35 + min(executions/10, 5) (基于执行次数动态调整)
 */
export class ScriptProvider implements CompletionProvider {
  name = "script"
  priority = 35 // 基础优先级
  enabled = true

  private scriptsCache: ScriptItem[] = []

  /**
   * 加载脚本库
   */
  loadScripts(scripts: ScriptItem[]) {
    this.scriptsCache = scripts
  }

  /**
   * 清空脚本缓存
   */
  clear() {
    this.scriptsCache = []
  }

  /**
   * 获取补全项
   */
  async getCompletions(context: CompletionContext): Promise<CompletionItem[]> {
    const { currentWord, fullLine, cursorPosition } = context

    const rawPrefix = fullLine.slice(
      0,
      Math.min(cursorPosition, fullLine.length)
    )
    const linePrefix = rawPrefix.trim()

    // 如果既没有行前缀也没有当前词, 不提供补全
    if (!linePrefix && !currentWord) {
      return []
    }

    return this.scriptsCache
      .filter(script => {
        // 行级 + token 级前缀匹配
        return matchesCommandWithPrefix(
          script.content,
          linePrefix,
          currentWord
        )
      })
      .map(script => {
        // 动态优先级：基于执行次数
        // 基础分35 + 最多+5分（执行100次以上）
        const executionBonus = Math.min(Math.floor(script.executions / 10), 5)
        const dynamicPriority = this.priority + executionBonus

        return {
          text: script.content,  // 补全文本使用 content（实际命令）
          displayText: script.content,  // 主文本显示命令内容
          type: "command" as const,
          source: "script" as const, // 来自脚本库
          description: script.name,  // 描述显示脚本名称
          priority: dynamicPriority,
          score: this.calculateScore(script, linePrefix || currentWord),
          providerName: "script",
        }
      })
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(script: ScriptItem, prefix: string): number {
    const commandLower = script.content.toLowerCase()
    const prefixLower = prefix.toLowerCase().trim()

    if (!prefixLower) return 0

    // 精确匹配整行命令
    if (commandLower === prefixLower) {
      return 120 + Math.min(script.executions, 20)
    }

    // 先尝试简单的字符串前缀匹配
    if (commandLower.startsWith(prefixLower)) {
      return 100 + Math.min(script.executions, 20)
    }

    // 基于 token 的前缀匹配：前面 token 完全相等，最后一个 token 允许前缀匹配
    const prefixTokens = prefixLower
      .split(/\s+/)
      .filter((token) => token.length > 0)
    const commandTokens = commandLower
      .split(/\s+/)
      .filter((token) => token.length > 0)

    if (prefixTokens.length === 0 || commandTokens.length === 0) {
      return 0
    }

    let matchedTokens = 0
    for (
      let index = 0;
      index < prefixTokens.length && index < commandTokens.length;
      index++
    ) {
      const prefixToken = prefixTokens[index]
      const commandToken = commandTokens[index]
      const isLast = index === prefixTokens.length - 1

      if (isLast) {
        // 最后一个词允许前缀匹配
        if (!commandToken.startsWith(prefixToken)) {
          break
        }
      } else {
        // 前面的词必须完全相等
        if (commandToken !== prefixToken) {
          break
        }
      }

      matchedTokens++
    }

    const coverage =
      prefixTokens.length > 0 ? matchedTokens / prefixTokens.length : 0

    let baseScore = 0
    if (coverage === 1) {
      baseScore = 95
    } else if (coverage >= 0.6) {
      baseScore = 85
    } else if (coverage > 0) {
      baseScore = 70
    } else if (commandLower.includes(prefixLower)) {
      // 退化为包含匹配
      baseScore = 60
    }

    // 执行次数加成，最多 +20
    const executionBonus = Math.min(script.executions, 20)

    return baseScore + executionBonus
  }

  /**
   * 获取缓存的脚本数量
   */
  getScriptCount(): number {
    return this.scriptsCache.length
  }

  /**
   * 根据名称查找脚本
   */
  findScript(name: string): ScriptItem | undefined {
    return this.scriptsCache.find(script => script.name === name)
  }
}
