"use client"

import * as React from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface SmartAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 用户头像URL (可以是生成的头像或上传的图片) */
  src?: string
  /** 用户名，用于生成字母头像 */
  username?: string
  /** 显示名称，用于生成字母头像 (优先于username) */
  displayName?: string
  /** 邮箱，用于辅助生成确定性头像 */
  email?: string
  /** 头像加载失败的回调 */
  onAvatarError?: (error: React.SyntheticEvent<HTMLImageElement>) => void
  /** 头像加载成功的回调 */
  onAvatarLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void
}

/**
 * 智能头像组件
 *
 * 显示优先级：
 * 1. 用户上传的图片头像 (src)
 * 2. DiceBear生成的头像 (如果src包含生成头像的特征)
 * 3. 字母头像 (基于displayName或username的首字母)
 */
export const SmartAvatar = React.forwardRef<HTMLDivElement, SmartAvatarProps>(
  ({ className, src, username, displayName, email, onAvatarError, onAvatarLoad, ...props }, ref) => {
    // 生成字母头像内容
    const avatarFallback = React.useMemo(() => {
      const name = displayName || username || "U"
      // 取前1-2个字符作为头像显示
      if (name.length >= 2) {
        return name.slice(0, 2).toUpperCase()
      }
      return name.charAt(0).toUpperCase()
    }, [displayName, username])

    // 检查是否为生成的头像 (DiceBear等)
    const isGeneratedAvatar = React.useMemo(() => {
      if (!src) return false
      return src.includes('dicebear.com') ||
             src.includes('data:image/svg+xml') ||
             src.includes('avatar') ||
             src.includes('generated')
    }, [src])

    // 生成渐变背景className (用于字母头像)
    const gradientClass = React.useMemo(() => {
      // 基于用户名生成一致的渐变色
      if (!username && !displayName) return "from-blue-500 to-purple-500"

      const name = (displayName || username || "").toLowerCase()
      const colors = [
        "from-blue-500 to-purple-500",
        "from-green-500 to-teal-500",
        "from-orange-500 to-red-500",
        "from-pink-500 to-rose-500",
        "from-indigo-500 to-blue-500",
        "from-yellow-500 to-orange-500",
        "from-purple-500 to-pink-500",
        "from-teal-500 to-green-500",
        "from-red-500 to-pink-500",
        "from-cyan-500 to-blue-500"
      ]

      // 使用简单的哈希算法选择颜色
      let hash = 0
      for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i)
        hash = hash & hash
      }

      const colorIndex = Math.abs(hash) % colors.length
      return colors[colorIndex]
    }, [username, displayName])

    // ���理头像加载错误
    const handleError = React.useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
      console.warn("Avatar image failed to load:", src)
      onAvatarError?.(event)
    }, [src, onAvatarError])

    // 处理头像加载成功
    const handleLoad = React.useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
      onAvatarLoad?.(event)
    }, [onAvatarLoad])

    return (
      <Avatar ref={ref} className={cn(className)} {...props}>
        <AvatarImage
          src={src}
          alt={displayName || username || "用户头像"}
          onError={handleError}
          onLoad={handleLoad}
        />
        <AvatarFallback
          className={cn(
            // 为字母头像添加渐变背景
            !src && `bg-gradient-to-br ${gradientClass}`,
            // 文字样式
            "text-white font-medium text-sm"
          )}
        >
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
    )
  }
)

SmartAvatar.displayName = "SmartAvatar"