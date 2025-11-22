/**
 * 终端补全引擎
 * 协调多个补全提供者,合并和排序补全结果
 */

import { LRUCache } from "lru-cache"
import type {
  CompletionProvider,
  CompletionContext,
  CompletionItem,
  CompletionResult,
  CompletionConfig,
  SourceQuotaConfig,
} from "./types"
import { DEFAULT_COMPLETION_CONFIG, DEFAULT_SOURCE_QUOTAS } from "./types"
import { getCommonPrefix } from "./utils"

/**
 * 补全引擎
 */
export class CompletionEngine {
  private providers: CompletionProvider[] = []
  private config: CompletionConfig
  private cache: LRUCache<string, CompletionResult>
  private sessionId: string // 会话ID，用于区分不同服务器

  constructor(sessionId: string, config?: Partial<CompletionConfig>) {
    this.sessionId = sessionId
    this.config = { ...DEFAULT_COMPLETION_CONFIG, ...config }

    // 初始化LRU缓存，使用配置的缓存参数
    const cacheConfig = this.config.cache || { ttl_minutes: 5, max_entries: 100 }
    this.cache = new LRUCache<string, CompletionResult>({
      max: cacheConfig.max_entries,
      ttl: 1000 * 60 * cacheConfig.ttl_minutes,
      updateAgeOnGet: true, // 访问时更新过期时间
    })
  }

  /**
   * 注册补全提供者
   */
  registerProvider(provider: CompletionProvider): void {
    this.providers.push(provider)
    // 按优先级排序
    this.providers.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 移除补全提供者
   */
  unregisterProvider(name: string): void {
    this.providers = this.providers.filter((p) => p.name !== name)
  }

  /**
   * 获取补全结果
   */
  async getCompletions(
    context: CompletionContext
  ): Promise<CompletionResult | null> {
    if (!this.config.enabled) {
      return null
    }

    // 如果当前词为空且不是命令位置,不补全
    if (context.currentWord === "" && context.currentTokenIndex > 0) {
      return null
    }

    // 生成缓存键：基于会话ID、当前词和token位置
    // 包含 sessionId 确保不同服务器的补全结果不会混淆
    // 注意：不包含 fullLine，避免因命令行上下文不同导致缓存命中率低
    const cacheKey = `${this.sessionId}:${context.currentWord}:${context.currentTokenIndex}`

    // 尝试从缓存获取
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    // 并行请求所有启用的提供者
    const enabledProviders = this.providers.filter((p) => p.enabled)

    const results = await Promise.allSettled(
      enabledProviders.map((provider) => provider.getCompletions(context))
    )

    // 合并所有成功的结果
    const allItems: CompletionItem[] = []

    for (const result of results) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value)
      }
    }

    // 如果没有补全项,返回 null
    if (allItems.length === 0) {
      return null
    }

    // 去重(基于 text)
    const uniqueItems = this.deduplicateItems(allItems)

    // 根据配置选择分配策略
    let limitedItems: CompletionItem[]

    if (this.config.enableQuotaAllocation && this.config.sourceQuotas) {
      // 使用配额分配
      limitedItems = this.allocateWithQuota(uniqueItems, context.currentWord)
    } else {
      // 使用原有的简单排序+截取
      const sortedItems = this.sortItems(uniqueItems, context.currentWord)
      limitedItems = sortedItems.slice(0, this.config.maxItems)
    }

    // 计算替换范围
    const replaceStart = context.cursorPosition - context.currentWord.length
    const replaceEnd = context.cursorPosition

    // 计算公共前缀
    const commonPrefix = getCommonPrefix(limitedItems.map((item) => item.text))

    const result: CompletionResult = {
      items: limitedItems,
      replaceStart,
      replaceEnd,
      commonPrefix,
    }

    // 写入缓存
    this.cache.set(cacheKey, result)

    return result
  }

  /**
   * 去重补全项
   */
  private deduplicateItems(items: CompletionItem[]): CompletionItem[] {
    const seen = new Map<string, CompletionItem>()

    for (const item of items) {
      const existing = seen.get(item.text)

      if (!existing) {
        seen.set(item.text, item)
      } else {
        // 如果已存在,保留优先级更高的
        if ((item.priority || 0) > (existing.priority || 0)) {
          seen.set(item.text, item)
        }
      }
    }

    return Array.from(seen.values())
  }

  /**
   * 配额分配算法(简化版 - 单轮分配)
   *
   * 算法逻辑：
   * 1. 按提供者分组并排序
   * 2. 按优先级顺序分配配额
   * 3. 如果有剩余空间，按优先级继续分配
   */
  private allocateWithQuota(
    items: CompletionItem[],
    prefix: string
  ): CompletionItem[] {
    const quotaConfigs = this.config.sourceQuotas || DEFAULT_SOURCE_QUOTAS
    const totalLimit = this.config.maxItems

    // 步骤1: 按提供者分组
    const itemsByProvider = new Map<string, CompletionItem[]>()

    for (const item of items) {
      const providerName = item.providerName || this.getProviderName(item)

      if (!itemsByProvider.has(providerName)) {
        itemsByProvider.set(providerName, [])
      }
      itemsByProvider.get(providerName)!.push(item)
    }

    // 步骤2: 每组内部排序
    for (const [_, groupItems] of itemsByProvider) {
      groupItems.sort((a, b) => this.compareItems(a, b, prefix))
    }

    // 步骤3: 单轮分配
    const result: CompletionItem[] = []
    let remaining = totalLimit

    // 按配额配置顺序分配（配置顺序即优先级）
    for (const config of quotaConfigs) {
      if (remaining <= 0) break

      const items = itemsByProvider.get(config.providerName) || []
      if (items.length === 0) continue

      // 计算本次分配数量
      let toTake: number
      if (config.unlimited) {
        // 无限制源：使用softMax或剩余空间
        toTake = Math.min(items.length, remaining, config.softMax || Infinity)
      } else {
        // 有限制源：使用max
        toTake = Math.min(items.length, remaining, config.max)
      }

      if (toTake > 0) {
        result.push(...items.slice(0, toTake))
        remaining -= toTake
      }
    }

    return result
  }

  /**
   * 根据 CompletionItem 判断来自哪个提供者
   */
  private getProviderName(item: CompletionItem): string {
    if (item.type === "history") {
      if (item.source === "remote") {
        return "remote-history"
      } else if (item.description?.includes("本次会话")) {
        return "session"
      }
    }

    if (
      item.description?.includes("脚本") ||
      item.displayText?.includes("次)")
    ) {
      return "script"
    }

    if (item.source === "local") {
      return "local"
    }

    return "unknown"
  }

  /**
   * 比较两个补全项(用于排序)
   */
  private compareItems(
    a: CompletionItem,
    b: CompletionItem,
    prefix: string
  ): number {
    // 1. 精确匹配优先
    const aExact = a.text === prefix ? 1 : 0
    const bExact = b.text === prefix ? 1 : 0
    if (aExact !== bExact) return bExact - aExact

    // 2. 前缀匹配优先
    const aPrefix = a.text.startsWith(prefix) ? 1 : 0
    const bPrefix = b.text.startsWith(prefix) ? 1 : 0
    if (aPrefix !== bPrefix) return bPrefix - aPrefix

    // 3. 按优先级排序
    const aPriority = a.priority || 0
    const bPriority = b.priority || 0
    if (aPriority !== bPriority) return bPriority - aPriority

    // 4. 按分数排序(如果有)
    const aScore = a.score || 0
    const bScore = b.score || 0
    if (aScore !== bScore) return bScore - aScore

    // 5. 按字母顺序排序
    return a.text.localeCompare(b.text)
  }

  /**
   * 排序补全项
   */
  private sortItems(
    items: CompletionItem[],
    prefix: string
  ): CompletionItem[] {
    return items.sort((a, b) => this.compareItems(a, b, prefix))
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompletionConfig>): void {
    const oldCacheConfig = this.config.cache
    this.config = { ...this.config, ...config }

    // 如果缓存配置发生变化，重建缓存
    const newCacheConfig = this.config.cache
    if (
      newCacheConfig &&
      (oldCacheConfig?.max_entries !== newCacheConfig.max_entries ||
        oldCacheConfig?.ttl_minutes !== newCacheConfig.ttl_minutes)
    ) {
      this.cache = new LRUCache<string, CompletionResult>({
        max: newCacheConfig.max_entries,
        ttl: 1000 * 60 * newCacheConfig.ttl_minutes,
        updateAgeOnGet: true,
      })
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): CompletionConfig {
    return { ...this.config }
  }

  /**
   * 启用/禁用提供者
   */
  setProviderEnabled(name: string, enabled: boolean): void {
    const provider = this.providers.find((p) => p.name === name)
    if (provider) {
      provider.enabled = enabled
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; max: number } {
    return {
      size: this.cache.size,
      max: this.cache.max,
    }
  }
}
