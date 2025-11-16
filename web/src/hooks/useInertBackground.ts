import { useEffect } from 'react'

/**
 * 当对话框打开时，使用 inert 属性禁用背景内容
 * 这比 aria-hidden 更好，因为它同时阻止焦点和交互
 */
export function useInertBackground(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return

    // 获取主要内容容器（通常是 body 的直接子元素）
    const mainContent = document.querySelector('main') || document.body.firstElementChild

    if (mainContent && mainContent instanceof HTMLElement) {
      // 保存原始状态
      const originalInert = mainContent.inert

      // 设置 inert
      mainContent.inert = true

      // 清理函数：恢复原始状态
      return () => {
        mainContent.inert = originalInert
      }
    }
  }, [isOpen])
}
