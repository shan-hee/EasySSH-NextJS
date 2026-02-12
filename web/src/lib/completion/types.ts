/**
 * 终端命令补全类型定义
 */

/**
 * 补全项类型
 */
export type CompletionItemType =
  | "command" // 命令
  | "subcommand" // 子命令
  | "option" // 选项/参数
  | "file" // 文件
  | "directory" // 目录
  | "variable" // 变量
  | "history" // 历史记录

/**
 * 补全项来源
 */
export type CompletionSource = "local" | "remote" | "history" | "script" | "ai"

/**
 * 补全项
 */
export interface CompletionItem {
  /** 补全文本 */
  text: string
  /** 显示文本(可选,默认使用 text) */
  displayText?: string
  /** 补全类型 */
  type: CompletionItemType
  /** 来源 */
  source: CompletionSource
  /** 描述信息 */
  description?: string
  /** 优先级(数字越大优先级越高) */
  priority?: number
  /** 匹配分数(用于排序) */
  score?: number
  /** 提供者名称(用于配额分配) */
  providerName?: string
}

/**
 * 补全上下文
 */
export interface CompletionContext {
  /** 完整输入行 */
  fullLine: string
  /** 当前光标位置 */
  cursorPosition: number
  /** 当前输入的词(光标所在位置) */
  currentWord: string
  /** 已分词的命令 */
  tokens: string[]
  /** 当前词在 tokens 中的索引 */
  currentTokenIndex: number
}

/**
 * 补全结果
 */
export interface CompletionResult {
  /** 补全项列表 */
  items: CompletionItem[]
  /** 替换起始位置 */
  replaceStart: number
  /** 替换结束位置 */
  replaceEnd: number
  /** 公共前缀(如果有) */
  commonPrefix?: string
}

/**
 * 补全提供者接口
 */
export interface CompletionProvider {
  /** 提供者名称 */
  name: string
  /** 优先级(数字越大优先级越高) */
  priority: number
  /** 是否启用 */
  enabled: boolean
  /**
   * 获取补全项
   * @param context 补全上下文
   * @returns 补全项列表,如果不支持则返回空数组
   */
  getCompletions(context: CompletionContext): Promise<CompletionItem[]>
}

/**
 * 来源配额配置
 */
export interface SourceQuotaConfig {
  /** 提供者名称 */
  providerName: string
  /** 最少数量(优先保证) */
  min: number
  /** 最多数量 */
  max: number
  /** 是否无限制(填充剩余位置) */
  unlimited?: boolean
  /** 软上限(仅对无限制源有效,避免占满所有位置) */
  softMax?: number
}

/**
 * 补全配置
 */
export interface CompletionConfig {
  /** 是否启用补全 */
  enabled: boolean
  /** 触发方式 */
  trigger: "tab" | "auto"
  /** 自动触发延迟(毫秒) */
  autoTriggerDelay: number
  /** 最大显示数量 */
  maxItems: number
  /** 启用的提供者 */
  providers: {
    local: boolean
    remote: boolean
    history: boolean
    script?: boolean
    session?: boolean
  }
  /** 是否显示描述 */
  showDescription: boolean
  /** 是否显示图标 */
  showIcon: boolean
  /** 是否启用配额分配 */
  enableQuotaAllocation?: boolean
  /** 来源配额配置 */
  sourceQuotas?: SourceQuotaConfig[]
  /** 缓存配置 */
  cache?: {
    ttl_minutes: number
    max_entries: number
  }
}

/**
 * 默认来源配额配置
 */
export const DEFAULT_SOURCE_QUOTAS: SourceQuotaConfig[] = [
  { providerName: "local", min: 1, max: 3 },
  { providerName: "script", min: 0, max: 2 },
  { providerName: "session", min: 0, max: 2 },
  {
    providerName: "remote-history",
    min: 0,
    max: Infinity,
    unlimited: true,
    softMax: 7,
  },
]

/**
 * 默认补全配置
 */
export const DEFAULT_COMPLETION_CONFIG: CompletionConfig = {
  enabled: true,
  trigger: "tab",
  autoTriggerDelay: 200,
  maxItems: 10,
  providers: {
    local: true,
    remote: false, // Phase 2 实现后默认开启
    history: false, // Phase 3 实现后默认开启
    script: false,
    session: false,
  },
  showDescription: true,
  showIcon: true,
  enableQuotaAllocation: true,
  sourceQuotas: DEFAULT_SOURCE_QUOTAS,
}
