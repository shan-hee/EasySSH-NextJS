/**
 * 全局拖拽状态管理
 * 用于跨组件共享当前拖拽的源会话ID
 * 解决 dragenter/dragover 事件中无法读取 dataTransfer.getData() 的问题
 */

let currentDragSourceSessionId: string | null = null

export function setDragSourceSessionId(sessionId: string | null) {
  currentDragSourceSessionId = sessionId
}

export function getDragSourceSessionId(): string | null {
  return currentDragSourceSessionId
}
