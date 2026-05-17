"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import Editor from "@monaco-editor/react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  X,
  Save,
  RotateCcw,
  FileText,
  Download,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Search,
  Replace,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FileEditorProps {
  fileName: string
  filePath: string
  fileContent: string
  isOpen: boolean
  onClose: () => void
  onSave: (content: string) => void
  onDownload?: () => void
}

type MonacoEditorHandle = {
  getAction?: (id: string) => { run?: () => unknown } | null | undefined
  layout?: () => void
}

export function FileEditor({
  fileName,
  fileContent,
  isOpen,
  onClose,
  onSave,
  onDownload,
}: FileEditorProps) {
  const tSftp = useTranslations("sftp")
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light'
  const [content, setContent] = useState(fileContent || '')
  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const wordWrap: 'on' | 'off' = 'on'
  const fontSize = 13
  const showMinimap = false // 默认关闭小地图提升性能
  const editorRef = useRef<MonacoEditorHandle | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)

  // 缓存文件统计信息，避免每次渲染都计算
  const fileStats = useMemo(() => {
    const lines = content ? content.split('\n').length : 0
    const chars = content ? content.length : 0
    return { lines, chars }
  }, [content])

  // 当文件内容变化时更新编辑器内容
  useEffect(() => {
    setContent(fileContent || '')
    setIsModified(false)
  }, [fileContent, fileName])

  // 获取文件语言类型
  const getLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      bash: 'shell',
      sql: 'sql',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      txt: 'plaintext',
      log: 'plaintext',
    }

    return languageMap[ext] || 'plaintext'
  }

  // 处理内容变化
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value)
      setIsModified(value !== fileContent)
    }
  }

  // 保存文件
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(content || '')
      setIsModified(false)
    } finally {
      setIsSaving(false)
    }
  }, [content, onSave])

  // 重置内容
  const handleReset = () => {
    setContent(fileContent || '')
    setIsModified(false)
  }

  // 查找
  const handleFind = () => {
    editorRef.current?.getAction?.('actions.find')?.run?.()
  }

  // 替换
  const handleReplace = () => {
    editorRef.current?.getAction?.('editor.action.startFindReplaceAction')?.run?.()
  }

  // 格式化代码
  const formatCode = () => {
    editorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + S 保存
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (isModified) {
        handleSave()
      }
    }
    // Esc 关闭或退出全屏
    if (e.key === 'Escape') {
      e.preventDefault()
      if (isFullscreen) {
        setIsFullscreen(false)
      } else {
        onClose()
      }
    }
  }, [isModified, isFullscreen, handleSave, onClose])

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (!isOpen || !editorContainerRef.current) {
      return
    }

    let frame = 0
    const layoutEditor = () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0
        editorRef.current?.layout?.()
      })
    }

    const resizeObserver = new ResizeObserver(layoutEditor)
    resizeObserver.observe(editorContainerRef.current)
    layoutEditor()

    return () => {
      resizeObserver.disconnect()
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [isFullscreen, isOpen])

  if (!isOpen) return null

  // 全屏内容
  const fullscreenContent = (
    <div className="fixed inset-0 z-[9999] flex min-w-0 flex-col overflow-hidden bg-background">
        <div
          className={cn(
            "flex h-full min-w-0 flex-col overflow-hidden bg-white dark:bg-zinc-900",
          )}
        >
          {/* 编辑器工具栏 */}
          <div
            className={cn(
              "flex min-w-0 items-center justify-between gap-2 px-3 py-2 border-b bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800",
            )}
          >
            {/* 左侧：文件信息 */}
            <div className="flex min-w-0 items-center gap-2">
              <FileText className={cn(
                "h-4 w-4 text-blue-500 dark:text-blue-400",
              )} />
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold text-sm">{fileName}</span>
                {isModified && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {tSftp("editorBadgeUnsaved")}
                  </Badge>
                )}
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Find */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={handleFind}
                title={tSftp("editorActionFindTooltip")}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">{tSftp("editorActionFind")}</span>
              </Button>

              {/* Replace */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={handleReplace}
                title={tSftp("editorActionReplaceTooltip")}
              >
                <Replace className="h-3.5 w-3.5" />
                <span className="text-xs">{tSftp("editorActionReplace")}</span>
              </Button>

              {/* Format */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={formatCode}
                title={tSftp("editorActionFormatTooltip")}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span className="text-xs">{tSftp("editorActionFormat")}</span>
              </Button>

              <div className={cn(
                "h-6 w-px mx-1 bg-zinc-200 dark:bg-zinc-800",
              )} />

              {/* Reset */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={handleReset}
                disabled={!isModified}
                title={tSftp("editorActionResetTooltip")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="text-xs">{tSftp("editorActionReset")}</span>
              </Button>

              {/* Download */}
              {onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1.5 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                  )}
                  onClick={onDownload}
                  title={tSftp("editorActionDownloadTooltip")}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">{tSftp("editorActionDownload")}</span>
                </Button>
              )}

              {/* Save */}
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700",
                )}
                onClick={handleSave}
                disabled={!isModified || isSaving}
                title={tSftp("editorActionSaveTooltip")}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {isSaving
                    ? tSftp("editorActionSaveSaving")
                    : tSftp("editorActionSave")}
                </span>
              </Button>

              <div className={cn(
                "h-6 w-px mx-1 bg-zinc-200 dark:bg-zinc-800",
              )} />

              {/* Exit fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={toggleFullscreen}
                title={tSftp("editorFullscreenExitTooltip")}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>

              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                )}
                onClick={onClose}
                title={tSftp("editorCloseTooltip")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div ref={editorContainerRef} className="flex-1 min-h-0 min-w-0 overflow-hidden">
             <Editor
               height="100%"
               width="100%"
               language={getLanguage(fileName)}
               value={content}
               onChange={handleEditorChange}
              theme={monacoTheme}
               options={{
                 fontSize: fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                fontLigatures: true,
                lineNumbers: "on",
                minimap: { enabled: showMinimap },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: wordWrap,
                formatOnPaste: false, // 关闭粘贴时自动格式化，避免性能问题
                formatOnType: false, // 关闭输入时自动格式化，避免性能问题
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
                smoothScrolling: false, // 关闭平滑滚动，减少重绘
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "off", // 关闭光标平滑动画，减少重绘
                padding: { top: 16, bottom: 16 },
                find: {
                  addExtraSpaceOnTop: true,
                  autoFindInSelection: "never",
                  seedSearchStringFromSelection: "selection",
                },
              }}
              onMount={(editor) => {
                editorRef.current = editor
                window.requestAnimationFrame(() => editor.layout())
              }}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className={cn(
                    "text-sm text-zinc-400 dark:text-zinc-500",
                  )}>
                    {tSftp("editorLoading")}
                  </div>
                </div>
              }
            />
          </div>

          {/* 底部状态栏 */}
          <div
            className={cn(
              "flex min-w-0 items-center justify-between gap-3 px-3 py-1 border-t text-xs bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="font-mono">
                {getLanguage(fileName).toUpperCase()}
              </span>
              <span>UTF-8</span>
              <span>LF</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span>
                {tSftp("editorStatusLine", { line: fileStats.lines })}
              </span>
              <span>
                {tSftp("editorStatusChars", { count: fileStats.chars })}
              </span>
              {isModified && (
                <span className={"text-yellow-600 dark:text-yellow-400"}>
                  {tSftp("editorStatusModified")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
  )

  // 全屏模式 - 使用 Portal 渲染到 body
  if (isFullscreen) {
    return typeof window !== 'undefined'
      ? createPortal(fullscreenContent, document.body)
      : null
  }

  // 嵌入模式
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-2 px-3 py-2 border-b bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800",
        )}
      >
        {/* Left: file info */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={onClose}
            title={tSftp("editorTitleBackToList")}
            aria-label={tSftp("editorTitleBackToList")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className={cn(
            "h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400",
          )} />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-sm">{fileName}</span>
            {isModified && (
              <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                {tSftp("editorBadgeUnsaved")}
              </Badge>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Find */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={handleFind}
            title={tSftp("editorActionFindTooltip")}
            aria-label={tSftp("editorActionFind")}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={handleReplace}
            title={tSftp("editorActionReplaceTooltip")}
            aria-label={tSftp("editorActionReplace")}
          >
            <Replace className="h-3.5 w-3.5" />
          </Button>

          {/* Format */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={formatCode}
            title={tSftp("editorActionFormatTooltip")}
            aria-label={tSftp("editorActionFormat")}
          >
            <FileCode className="h-3.5 w-3.5" />
          </Button>

          <div className={cn(
            "h-6 w-px mx-1 bg-zinc-200 dark:bg-zinc-800",
          )} />

          {/* Reset */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={handleReset}
            disabled={!isModified}
            title={tSftp("editorActionResetTooltip")}
            aria-label={tSftp("editorActionReset")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          {/* Download */}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
              )}
              onClick={onDownload}
              title={tSftp("editorActionDownloadTooltip")}
              aria-label={tSftp("editorActionDownload")}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Save */}
          <Button
            variant="default"
            size="icon"
            className={cn(
              "h-7 w-7 bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700",
            )}
            onClick={handleSave}
            disabled={!isModified || isSaving}
            title={tSftp("editorActionSaveTooltip")}
            aria-label={isSaving ? tSftp("editorActionSaveSaving") : tSftp("editorActionSave")}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>

          <div className={cn(
            "h-6 w-px mx-1 bg-zinc-200 dark:bg-zinc-800",
          )} />

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white",
            )}
            onClick={toggleFullscreen}
            title={tSftp("editorFullscreenEnterTooltip")}
            aria-label={tSftp("editorFullscreenEnterTooltip")}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div ref={editorContainerRef} className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <Editor
          height="100%"
          width="100%"
          language={getLanguage(fileName)}
          value={content}
          onChange={handleEditorChange}
          theme={monacoTheme}
          options={{
            fontSize: fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            lineNumbers: "on",
            minimap: { enabled: showMinimap },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: wordWrap,
            formatOnPaste: false, // 关闭粘贴时自动格式化，避免性能问题
            formatOnType: false, // 关闭输入时自动格式化，避免性能问题
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            smoothScrolling: false, // 关闭平滑滚动，减少重绘
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "off", // 关闭光标平滑动画，减少重绘
            padding: { top: 12, bottom: 12 },
            find: {
              addExtraSpaceOnTop: true,
              autoFindInSelection: "never",
              seedSearchStringFromSelection: "selection",
            },
          }}
          onMount={(editor) => {
            editorRef.current = editor
            window.requestAnimationFrame(() => editor.layout())
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className={cn(
                "text-sm text-zinc-400 dark:text-zinc-500",
              )}>
                {tSftp("editorLoading")}
              </div>
            </div>
          }
        />
      </div>

      {/* 底部状态栏 */}
      <div
        className={cn(
          "flex min-w-0 items-center justify-between gap-3 px-3 py-1 border-t text-xs bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono">
            {getLanguage(fileName).toUpperCase()}
          </span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span>
            {tSftp("editorStatusLine", { line: fileStats.lines })}
          </span>
          <span>
            {tSftp("editorStatusChars", { count: fileStats.chars })}
          </span>
          {isModified && (
            <span className={"text-yellow-600 dark:text-yellow-400"}>
              {tSftp("editorStatusModified")}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
