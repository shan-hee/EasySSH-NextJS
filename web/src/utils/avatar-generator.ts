/**
 * 头像生成工具函数
 * 基于DiceBear API生成独特的用户头像
 */

/**
 * 生成DiceBear头像
 * @param seed - 可选的种子值，用于生成一致的头像（如用户名、邮箱等）
 * @returns Promise<string> - 返回base64编码的SVG头像数据URL
 */
export async function generateDiceBearAvatar(seed?: string): Promise<string> {
  try {
    // 使用提供的种子或生成随机种子
    const finalSeed = seed || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // DiceBear API URL - 使用notionists-neutral风格
    const dicebearUrl = `https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${finalSeed}`

    // 获取SVG内容
    const response = await fetch(dicebearUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch avatar: ${response.status} ${response.statusText}`)
    }

    const svgText = await response.text()

    // 将SVG转换为base64 data URL
    const base64 = btoa(unescape(encodeURIComponent(svgText)))
    const dataUrl = `data:image/svg+xml;base64,${base64}`

    return dataUrl
  } catch (error) {
    console.error("生成DiceBear头像失败:", error)
    throw new Error("头像生成失败，请稍后重试")
  }
}

/**
 * 基于用户信息生成确定性种子
 * @param username - 用户名
 * @param email - 邮箱（可选）
 * @returns string - 确定性的种子值
 */
export function generateUserSeed(username: string, email?: string): string {
  // 使用用户名作为主要种子
  let seedInput = username.toLowerCase().trim()

  // 如果有邮箱，组合使用以增加唯一性
  if (email) {
    seedInput += email.toLowerCase().trim()
  }

  // 简单的哈希函数生成确定性种子
  let hash = 0
  for (let i = 0; i < seedInput.length; i++) {
    const char = seedInput.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }

  // 转换为正数并转为16进制字符串
  return Math.abs(hash).toString(16)
}

/**
 * 为新用户生成头像
 * @param username - 用户名
 * @param email - 邮箱（可选）
 * @returns Promise<string> - 生成的头像数据URL
 */
export async function generateAvatarForNewUser(username: string, email?: string): Promise<string> {
  // 基于用户信息生成确定性种子
  const seed = generateUserSeed(username, email)

  // 使用确定性种子生成头像
  return await generateDiceBearAvatar(seed)
}

/**
 * 验证头像数据URL是否有效
 * @param dataUrl - 头像数据URL
 * @returns boolean - 是否为有效的头像
 */
export function isValidAvatarDataUrl(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return false
  }

  // 检查是否为有效的data URL格式
  return dataUrl.startsWith('data:image/') && dataUrl.includes('base64,')
}