"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface FadeSlideInProps {
  children: ReactNode
  delay?: number
  duration?: number
  distance?: number
  className?: string
}

export function FadeSlideIn({
  children,
  delay = 0,
  duration = 0.8,
  distance = 30,
  className = "",
}: FadeSlideInProps) {
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