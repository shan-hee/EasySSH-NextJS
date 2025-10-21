"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Editor from "@monaco-editor/react"
import { useTheme } from "next-themes"
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
  Type,
  WrapText,
  Copy,
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

export function FileEditor({
  fileName,
  filePath,
  fileContent,
  isOpen,
  onClose,
  onSave,
  onDownload,
}: FileEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [content, setContent] = useState(fileContent)
  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on')
  const [fontSize, setFontSize] = useState(13)
  const [showMinimap, setShowMinimap] = useState(true)
  const editorRef = useState<unknown | null>(null)

  // 当文件内容变化时更新编辑器内容
  useEffect(() => {
    setContent(fileContent)
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
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(content)
      setIsModified(false)
    } finally {
      setIsSaving(false)
    }
  }

  // 重置内容
  const handleReset = () => {
    setContent(fileContent)
    setIsModified(false)
  }

  // 切换自动换行
  const toggleWordWrap = () => {
    setWordWrap(prev => prev === 'on' ? 'off' : 'on')
  }

  // 调整字体大小
  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 1, 24))
  }

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 1, 10))
  }

  // 切换小地图
  const toggleMinimap = () => {
    setShowMinimap(prev => !prev)
  }

  // 复制全部内容
  const copyAll = () => {
    navigator.clipboard.writeText(content)
  }

  // 查找
  const handleFind = () => {
    if (editorRef[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editorRef[0] as any).getAction?.('actions.find')?.run()
    }
  }

  // 替换
  const handleReplace = () => {
    if (editorRef[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editorRef[0] as any).getAction?.('editor.action.startFindReplaceAction')?.run()
    }
  }

  // 格式化代码
  const formatCode = () => {
    if (editorRef[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editorRef[0] as any).getAction?.('editor.action.formatDocument')?.run()
    }
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 键盘快捷键
  const handleKeyDown = (e: KeyboardEvent) => {
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
  }

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isModified, content, isFullscreen])

  if (!isOpen) return null

  // 全屏内容
  const fullscreenContent = (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
        <div
          className={cn(
            "flex flex-col h-full",
            isDark ? "bg-zinc-900" : "bg-white"
          )}
        >
          {/* 编辑器工具栏 */}
          <div
            className={cn(
              "flex items-center justify-between px-3 py-2 border-b",
              isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            )}
          >
            {/* 左侧：文件信息 */}
            <div className="flex items-center gap-2">
              <FileText className={cn(
                "h-4 w-4",
                isDark ? "text-blue-400" : "text-blue-500"
              )} />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{fileName}</span>
                {isModified && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    未保存
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-mono",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}>
                {filePath}
              </span>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-1">
              {/* 查找 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={handleFind}
                title="查找 (Ctrl+F)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">查找</span>
              </Button>

              {/* 替换 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={handleReplace}
                title="替换 (Ctrl+H)"
              >
                <Replace className="h-3.5 w-3.5" />
                <span className="text-xs">替换</span>
              </Button>

              {/* 格式化 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={formatCode}
                title="格式化代码"
              >
                <FileCode className="h-3.5 w-3.5" />
                <span className="text-xs">格式化</span>
              </Button>

              <div className={cn(
                "h-6 w-px mx-1",
                isDark ? "bg-zinc-800" : "bg-zinc-200"
              )} />

              {/* 重置 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={handleReset}
                disabled={!isModified}
                title="重置更改"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="text-xs">重置</span>
              </Button>

              {/* 下载 */}
              {onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1.5",
                    isDark
                      ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      : "hover:bg-zinc-100 text-zinc-600"
                  )}
                  onClick={onDownload}
                  title="下载文件"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">下载</span>
                </Button>
              )}

              {/* 保存 */}
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5",
                  isDark
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                )}
                onClick={handleSave}
                disabled={!isModified || isSaving}
                title="保存文件 (Ctrl+S)"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="text-xs">{isSaving ? "保存中..." : "保存"}</span>
              </Button>

              <div className={cn(
                "h-6 w-px mx-1",
                isDark ? "bg-zinc-800" : "bg-zinc-200"
              )} />

              {/* 退出全屏 */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={toggleFullscreen}
                title="退出全屏 (Esc)"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>

              {/* 关闭 */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  isDark
                    ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    : "hover:bg-zinc-100 text-zinc-600"
                )}
                onClick={onClose}
                title="关闭编辑器"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={getLanguage(fileName)}
              value={content}
              onChange={handleEditorChange}
              theme={isDark ? "vs-dark" : "light"}
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
                formatOnPaste: true,
                formatOnType: true,
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                padding: { top: 16, bottom: 16 },
                find: {
                  addExtraSpaceOnTop: false,
                  autoFindInSelection: "never",
                  seedSearchStringFromSelection: "selection",
                },
              }}
              onMount={(editor) => {
                editorRef[0] = editor
              }}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className={cn(
                    "text-sm",
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  )}>
                    加载编辑器...
                  </div>
                </div>
              }
            />
          </div>

          {/* 底部状态栏 */}
          <div
            className={cn(
              "flex items-center justify-between px-3 py-1 border-t text-xs",
              isDark
                ? "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                : "bg-zinc-50 border-zinc-200 text-zinc-600"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono">
                {getLanguage(fileName).toUpperCase()}
              </span>
              <span>UTF-8</span>
              <span>LF</span>
            </div>
            <div className="flex items-center gap-3">
              <span>行 {content.split('\n').length}</span>
              <span>字符 {content.length}</span>
              {isModified && (
                <span className={isDark ? "text-yellow-400" : "text-yellow-600"}>
                  • 已修改
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
    <div className="flex flex-col h-full">
      {/* 编辑器工具栏 */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"
        )}
      >
        {/* 左侧：文件信息 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={onClose}
            title="返回文件列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className={cn(
            "h-4 w-4",
            isDark ? "text-blue-400" : "text-blue-500"
          )} />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{fileName}</span>
            {isModified && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                未保存
              </Badge>
            )}
          </div>
          <span className={cn(
            "text-xs font-mono",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )}>
            {filePath}
          </span>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1">
          {/* 查找 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1.5",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={handleFind}
            title="查找 (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">查找</span>
          </Button>

          {/* 替换 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1.5",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={handleReplace}
            title="替换 (Ctrl+H)"
          >
            <Replace className="h-3.5 w-3.5" />
            <span className="text-xs">替换</span>
          </Button>

          {/* 格式化 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1.5",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={formatCode}
            title="格式化代码"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span className="text-xs">格式化</span>
          </Button>

          <div className={cn(
            "h-6 w-px mx-1",
            isDark ? "bg-zinc-800" : "bg-zinc-200"
          )} />

          {/* 重置 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1.5",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={handleReset}
            disabled={!isModified}
            title="重置更改"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-xs">重置</span>
          </Button>

          {/* 下载 */}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 gap-1.5",
                isDark
                  ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  : "hover:bg-zinc-100 text-zinc-600"
              )}
              onClick={onDownload}
              title="下载文件"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">下载</span>
            </Button>
          )}

          {/* 保存 */}
          <Button
            variant="default"
            size="sm"
            className={cn(
              "h-7 px-2 gap-1.5",
              isDark
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
            onClick={handleSave}
            disabled={!isModified || isSaving}
            title="保存文件 (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="text-xs">{isSaving ? "保存中..." : "保存"}</span>
          </Button>

          <div className={cn(
            "h-6 w-px mx-1",
            isDark ? "bg-zinc-800" : "bg-zinc-200"
          )} />

          {/* 全屏 */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-100 text-zinc-600"
            )}
            onClick={toggleFullscreen}
            title="全屏"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={getLanguage(fileName)}
          value={content}
          onChange={handleEditorChange}
          theme={isDark ? "vs-dark" : "light"}
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
            formatOnPaste: true,
            formatOnType: true,
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            padding: { top: 12, bottom: 12 },
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: "never",
              seedSearchStringFromSelection: "selection",
            },
          }}
          onMount={(editor) => {
            editorRef[0] = editor
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className={cn(
                "text-sm",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}>
                加载编辑器...
              </div>
            </div>
          }
        />
      </div>

      {/* 底部状态栏 */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1 border-t text-xs",
          isDark
            ? "bg-zinc-900/50 border-zinc-800 text-zinc-500"
            : "bg-zinc-50 border-zinc-200 text-zinc-600"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono">
            {getLanguage(fileName).toUpperCase()}
          </span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>
        <div className="flex items-center gap-3">
          <span>行 {content.split('\n').length}</span>
          <span>字符 {content.length}</span>
          {isModified && (
            <span className={isDark ? "text-yellow-400" : "text-yellow-600"}>
              • 已修改
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
