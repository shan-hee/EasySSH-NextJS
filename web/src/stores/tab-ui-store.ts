/**
 * 页签 UI 状态管理
 * 存储每个页签独立的 UI 状态（监控面板、文件管理器、AI 助手等）
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TabUIState {
  isMonitorOpen: boolean
  isFileManagerOpen: boolean
  isAiInputOpen: boolean
}

interface TabUIStoreState {
  // sessionId -> TabUIState
  tabStates: Map<string, TabUIState>

  // 获取页签状态（带默认值）
  getTabState: (sessionId: string) => TabUIState

  // 设置页签状态
  setTabState: (sessionId: string, state: Partial<TabUIState>) => void

  // 删除页签状态
  deleteTabState: (sessionId: string) => void

  // 清理所有状态
  clearAll: () => void
}

const DEFAULT_TAB_STATE: TabUIState = {
  isMonitorOpen: true,
  isFileManagerOpen: false,
  isAiInputOpen: false,
}

export const useTabUIStore = create<TabUIStoreState>()(
  persist(
    (set, get) => ({
      tabStates: new Map<string, TabUIState>(),

      getTabState: (sessionId: string) => {
        return get().tabStates.get(sessionId) || DEFAULT_TAB_STATE
      },

      setTabState: (sessionId: string, state: Partial<TabUIState>) => {
        set((store) => {
          const newStates = new Map(store.tabStates)
          const currentState = newStates.get(sessionId) || DEFAULT_TAB_STATE
          newStates.set(sessionId, { ...currentState, ...state })
          return { tabStates: newStates }
        })
      },

      deleteTabState: (sessionId: string) => {
        set((store) => {
          const newStates = new Map(store.tabStates)
          newStates.delete(sessionId)
          return { tabStates: newStates }
        })
      },

      clearAll: () => {
        set({ tabStates: new Map() })
      },
    }),
    {
      name: 'tab-ui-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          return {
            ...parsed,
            state: {
              ...parsed.state,
              tabStates: new Map(parsed.state?.tabStates || []),
            },
          }
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              tabStates: Array.from(value.state.tabStates.entries()),
            },
          }
          localStorage.setItem(name, JSON.stringify(serialized))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
