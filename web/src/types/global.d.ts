// 全局类型扩展

// 确保 HTMLElement 支持 inert 属性
declare global {
  interface HTMLElement {
    inert?: boolean
  }
}

export {}
