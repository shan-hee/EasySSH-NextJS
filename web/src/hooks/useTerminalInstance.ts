/**
 * 终端实例管理 Hook
 * 负责从全局 Store 获取或创建终端实例,并处理 DOM 挂载
 */

import { useEffect, useRef, useState } from 'react'
import { useTerminalStore, type TerminalInstanceState } from '@/stores/terminal-store'
import type { TerminalTheme } from '@/components/terminal/terminal-themes'

export interface TerminalConfig {
  theme: TerminalTheme
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  enableWebgl?: boolean
}

/**
 * 获取或创建终端实例
 */
export function useTerminalInstance(
  sessionId: string,
  config: TerminalConfig,
  enabled: boolean = true
) {
  const [isClient, setIsClient] = useState(false)
  const [terminalReady, setTerminalReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const initializingRef = useRef(false) // 防止重复初始化

  const getTerminal = useTerminalStore(state => state.getTerminal)
  const setTerminal = useTerminalStore(state => state.setTerminal)
  const updateMountState = useTerminalStore(state => state.updateMountState)

  const attachTerminalToContainer = (
    instance: TerminalInstanceState,
    container: HTMLDivElement
  ) => {
    const terminalElement = instance.terminal.element

    if (terminalElement) {
      if (terminalElement.parentElement !== container) {
        container.replaceChildren(terminalElement)
      }
    } else {
      instance.terminal.open(container)
    }

    requestAnimationFrame(() => {
      instance.fitAddon.fit()
      instance.terminal.refresh(0, instance.terminal.rows - 1)
    })
  }

  const setWebglAddon = (addon: { dispose: () => void } | null) => {
    const instance = getTerminal(sessionId)
    if (!instance) return

    setTerminal(sessionId, {
      ...instance,
      webglAddon: addon,
    })
  }

  const syncRendererMode = async (
    terminal: TerminalInstanceState["terminal"],
    enableWebgl: boolean
  ) => {
    const instance = getTerminal(sessionId)
    if (!instance || instance.terminal !== terminal) return

    if (!enableWebgl) {
      if (instance.webglAddon) {
        instance.webglAddon.dispose()
        setWebglAddon(null)
        terminal.refresh(0, terminal.rows - 1)
      }
      return
    }

    if (instance.webglAddon) {
      return
    }

    try {
      const { WebglAddon } = await import('@xterm/addon-webgl')
      const currentInstance = getTerminal(sessionId)

      if (!currentInstance || currentInstance.terminal !== terminal || currentInstance.webglAddon) {
        return
      }

      const webglAddon = new WebglAddon()

      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
        setWebglAddon(null)
      })

      terminal.loadAddon(webglAddon)
      setWebglAddon(webglAddon)
      terminal.refresh(0, terminal.rows - 1)
    } catch {
      // WebGL 不可用时自动降级到默认渲染器
    }
  }

  // 确保只在客户端执行
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 创建或获取终端实例
  useEffect(() => {
    if (!isClient || !enabled || !containerRef.current || initializingRef.current) return

    const existingInstance = getTerminal(sessionId)

    // 如果实例已存在，直接挂载
    if (existingInstance) {
      existingInstance.terminal.options.allowTransparency = true
      void syncRendererMode(existingInstance.terminal, config.enableWebgl !== false)

      // 检查是否已经挂载到当前容器
      if (!existingInstance.isMounted || existingInstance.container !== containerRef.current) {
        try {
          attachTerminalToContainer(existingInstance, containerRef.current)
          updateMountState(sessionId, true, containerRef.current)
          setTerminalReady(true)
        } catch (error) {
          console.error(`[useTerminalInstance] 挂载终端失败:`, error)
        }
      } else {
        setTerminalReady(true)
      }
      return
    }

    // 创建新终端实例
    initializingRef.current = true

    const initTerminal = async () => {
      try {
        // 动态导入 xterm.js 及其插件
        const [
          { Terminal: XTermTerminal },
          { FitAddon: XTermFitAddon },
          { WebLinksAddon },
        ] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
          // @ts-expect-error - CSS import
          import('@xterm/xterm/css/xterm.css'),
        ])

        // 创建终端实例
        const terminal = new XTermTerminal({
          theme: config.theme,
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          fontWeight: '400',
          fontWeightBold: '600',
          cursorBlink: config.cursorBlink,
          cursorStyle: config.cursorStyle,
          cursorWidth: config.cursorStyle === 'bar' ? 2 : 1,
          scrollback: config.scrollback,
          cols: 80,
          rows: 24,
          lineHeight: 1.2,
          letterSpacing: 0,
          // 性能优化选项
          allowProposedApi: true,
          allowTransparency: true,
          disableStdin: false,
          fastScrollModifier: 'shift',
          // 降低滚轮灵敏度，避免一次滚动跳动过多
          fastScrollSensitivity: 2,
          scrollSensitivity: 1,
          windowOptions: {},
        })

        // 添加插件
        const fitAddon = new XTermFitAddon()
        const webLinksAddon = new WebLinksAddon()

        terminal.loadAddon(fitAddon)
        terminal.loadAddon(webLinksAddon)

        // 打开终端
        terminal.open(containerRef.current!)
        fitAddon.fit()
        terminal.refresh(0, terminal.rows - 1)

        // 创建实例状态
        const instanceState: TerminalInstanceState = {
          terminal,
          fitAddon,
          webglAddon: null,
          wsConnection: null,
          isMounted: true,
          container: containerRef.current,
          createdAt: Date.now(),
        }

        // 保存到全局 Store
        setTerminal(sessionId, instanceState)
        setTerminalReady(true)

        void syncRendererMode(terminal, config.enableWebgl !== false)
      } catch (error) {
        console.error(`[useTerminalInstance] 创建终端实例失败:`, error)
      } finally {
        initializingRef.current = false
      }
    }

    initTerminal()

    // 组件卸载时，只标记为未挂载，不销毁实例
    return () => {
      updateMountState(sessionId, false)
      setTerminalReady(false)
    }
    // 注意：这里只依赖 sessionId 和 isClient，config 变化不会重新创建实例
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isClient, enabled])

  useEffect(() => {
    const instance = getTerminal(sessionId)
    if (!instance?.terminal) return

    void syncRendererMode(instance.terminal, config.enableWebgl !== false)
    // 这里不把 getTerminal/syncRendererMode 放进依赖，避免无意义重复执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, config.enableWebgl])

  // 返回终端实例和状态
  const instance = getTerminal(sessionId)

  return {
    terminal: instance?.terminal,
    fitAddon: instance?.fitAddon,
    terminalReady,
    containerRef,
    isClient,
  }
}
