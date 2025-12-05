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

    // 计算行前缀: 从命令行首到光标位置的内容
    const rawLinePrefix = context.fullLine.slice(
      0,
      Math.min(context.cursorPosition, context.fullLine.length)
    )
    const linePrefix = rawLinePrefix.trim()

    // 用于排序/缓存的“有效前缀”：优先使用整行前缀，退回当前词
    const effectivePrefix = linePrefix || context.currentWord

    // 如果既没有整行前缀也没有当前词,且不在命令位置,不补全
    if (!effectivePrefix && context.currentTokenIndex > 0) {
      return null
    }

    // 生成缓存键：基于会话ID、当前词和token位置
    // 包含 sessionId 确保不同服务器的补全结果不会混淆
    // 使用 effectivePrefix（优先整行前缀）以体现行级语义
    const cacheKey = `${this.sessionId}:${effectivePrefix}:${context.currentTokenIndex}`

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
      limitedItems = this.allocateWithQuota(uniqueItems, effectivePrefix)
    } else {
      // 使用原有的简单排序+截取
      const sortedItems = this.sortItems(uniqueItems, effectivePrefix)
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
      // 使用 providerName + text 作为 key，避免不同来源的相同命令被合并，
      // 保证脚本库/历史等各自的配额可以生效
      const providerKey = item.providerName || "unknown"
      const key = `${providerKey}:${item.text}`
      const existing = seen.get(key)

      if (!existing) {
        seen.set(key, item)
      } else {
        // 如果已存在,保留优先级更高的
        if ((item.priority || 0) > (existing.priority || 0)) {
          seen.set(key, item)
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

    // 1. 按提供者分组，并在组内按匹配度排序
    const itemsByProvider = new Map<string, CompletionItem[]>()
    for (const item of items) {
      const providerName = item.providerName || this.getProviderName(item)
      if (!itemsByProvider.has(providerName)) {
        itemsByProvider.set(providerName, [])
      }
      itemsByProvider.get(providerName)!.push(item)
    }

    for (const [providerName, groupItems] of itemsByProvider) {
      groupItems.sort((a, b) => this.compareItems(a, b, prefix))
      itemsByProvider.set(providerName, groupItems)
    }

    const result: CompletionItem[] = []
    const usedByProvider = new Map<string, number>()

    // 2. 先满足每个来源的 min 配额（如果有足够候选）
    for (const config of quotaConfigs) {
      const providerName = config.providerName
      const groupItems = itemsByProvider.get(providerName)
      if (!groupItems || groupItems.length === 0) continue
      if (result.length >= totalLimit) break

      const take = Math.min(config.min, groupItems.length, totalLimit - result.length)
      if (take <= 0) continue

      for (let i = 0; i < take; i++) {
        result.push(groupItems[i])
      }
      usedByProvider.set(providerName, take)
      itemsByProvider.set(providerName, groupItems.slice(take))
    }

    if (result.length >= totalLimit) {
      return result
    }

    // 3. 合并剩余候选，按全局匹配度排序
    const remainingPool: { providerName: string; item: CompletionItem }[] = []
    for (const [providerName, groupItems] of itemsByProvider) {
      for (const item of groupItems) {
        remainingPool.push({ providerName, item })
      }
    }

    remainingPool.sort((a, b) => this.compareItems(a.item, b.item, prefix))

    // 将配额配置转换为映射，便于快速查找 max / softMax
    const quotaMap = new Map<string, SourceQuotaConfig>()
    for (const config of quotaConfigs) {
      quotaMap.set(config.providerName, config)
    }

    // 4. 在不超过各来源 max 的前提下，用全局排序填满剩余空位
    for (const entry of remainingPool) {
      if (result.length >= totalLimit) break

      const providerName = entry.providerName
      const item = entry.item
      const config = quotaMap.get(providerName)

      let providerMax = totalLimit
      if (config) {
        if (config.unlimited) {
          providerMax = Math.min(config.softMax ?? totalLimit, totalLimit)
        } else {
          providerMax = config.max
        }
      }

      const used = usedByProvider.get(providerName) ?? 0
      if (used >= providerMax) {
        continue
      }

      result.push(item)
      usedByProvider.set(providerName, used + 1)
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
    _prefix: string
  ): number {
    // 1. 先按匹配分数排序（由各 Provider 基于整行内容计算）
    const aScore = a.score || 0
    const bScore = b.score || 0
    if (aScore !== bScore) return bScore - aScore

    // 2. 再按优先级排序（来源权重/业务权重）
    const aPriority = a.priority || 0
    const bPriority = b.priority || 0
    if (aPriority !== bPriority) return bPriority - aPriority

    // 3. 最后按字母顺序稳定排序
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
