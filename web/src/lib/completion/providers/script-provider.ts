import type { CompletionProvider, CompletionContext, CompletionItem } from "../types"

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
    const { currentWord, currentTokenIndex } = context

    // 如果当前词为空，不提供补全
    if (!currentWord) {
      return []
    }

    // 仅在第一个词（命令位置）提供脚本补全
    if (currentTokenIndex !== 0) {
      return []
    }

    return this.scriptsCache
      .filter(script => {
        // 前缀匹配脚本内容（实际命令）
        return script.content.toLowerCase().startsWith(currentWord.toLowerCase())
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
          score: this.calculateScore(script, currentWord),
          providerName: "script",
        }
      })
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(script: ScriptItem, prefix: string): number {
    const contentLower = script.content.toLowerCase()
    const prefixLower = prefix.toLowerCase()

    // 精确匹配
    if (script.content === prefix) return 100

    // 前缀匹配
    if (contentLower.startsWith(prefixLower)) {
      // 执行次数多的得分更高
      return 80 + Math.min(script.executions, 20)
    }

    // 包含匹配
    if (contentLower.includes(prefixLower)) {
      return 60 + Math.min(script.executions / 2, 10)
    }

    return 0
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
