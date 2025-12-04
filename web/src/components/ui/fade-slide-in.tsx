"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface FadeSlideInProps {
  children: ReactNode
  delay?: number
  duration?: number
  distance?: number
  className?: string
  /** 禁用动画，直接渲染子元素 */
  disabled?: boolean
}

export function FadeSlideIn({
  children,
  delay = 0,
  duration = 0.8,
  distance = 30,
  className = "",
  disabled = false,
}: FadeSlideInProps) {
  // 禁用动画时直接渲染子元素
  if (disabled) {
    return className ? <div className={className}>{children}</div> : <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1], // 平滑的缓动函数
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}