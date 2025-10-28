"use client"

import React, { useRef, ReactNode } from 'react'
import { motion, useInView } from 'motion/react'

interface AnimatedItemProps {
  children: ReactNode
  delay?: number
  index: number
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, delay = 0, index }) => {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5, once: false })

  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.95, opacity: 0, y: 10 }}
      animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0, y: 10 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      layout
      className="w-full"
    >
      {children}
    </motion.div>
  )
}

interface AnimatedListProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = '',
  staggerDelay = 0.05
}) => {
  const childrenArray = React.Children.toArray(children)

  return (
    <div className={className}>
      {childrenArray.map((child, index) => (
        <AnimatedItem
          key={(child as React.ReactElement).key || index}
          index={index}
          delay={index * staggerDelay}
        >
          {child}
        </AnimatedItem>
      ))}
    </div>
  )
}

export default AnimatedList
