"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full",
        // 防止闪烁: 使用 opacity 过渡而不是 display
        "transition-opacity duration-200",
        className
      )}
      // 添加图片加载优化
      loading="eager"
      decoding="async"
      style={{
        // 防止图片闪烁: 保持空间占位
        minWidth: '100%',
        minHeight: '100%',
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        // 延迟显示 Fallback,避免从缓存加载时的闪烁
        "animate-in fade-in-0 duration-300",
        className
      )}
      // 延迟显示 Fallback (300ms后才显示)
      delayMs={300}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
