"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Settings,
  Terminal,
  Palette,
  Keyboard,
  Clock,
  Layers
} from "lucide-react"

export interface TerminalSettings {
  // 终端设置
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  rightClickPaste: boolean
  copyOnSelect: boolean

  // 主题设置
  theme: 'default' | 'dark' | 'light' | 'solarized' | 'dracula'
  opacity: number
  backgroundImage: string
  backgroundImageOpacity: number

  // 行为设置
  maxTabs: number
  inactiveMinutes: number
  hibernateBackground: boolean
  autoReconnect: boolean
  confirmBeforeClose: boolean

  // 快捷键设置
  copyShortcut: string
  pasteShortcut: string
  clearShortcut: string
}

interface TerminalSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: TerminalSettings
  onSettingsChange: (settings: TerminalSettings) => void
}

const defaultSettings: TerminalSettings = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 1000,
  rightClickPaste: true,
  copyOnSelect: true,
  theme: 'default',
  opacity: 95,
  backgroundImage: '',
  backgroundImageOpacity: 20,
  maxTabs: 50,
  inactiveMinutes: 60,
  hibernateBackground: true,
  autoReconnect: true,
  confirmBeforeClose: true,
  copyShortcut: 'Ctrl+Shift+C',
  pasteShortcut: 'Ctrl+Shift+V',
  clearShortcut: 'Ctrl+L',
}

export function TerminalSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: TerminalSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  const handleSave = () => {
    onSettingsChange(localSettings)
    onOpenChange(false)
  }

  const handleReset = () => {
    setLocalSettings(defaultSettings)
  }

  const updateSetting = <K extends keyof TerminalSettings>(
    key: K,
    value: TerminalSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            终端设置
          </DialogTitle>
          <DialogDescription>
            配置终端外观、行为和快捷键设置
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="terminal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="terminal" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              终端
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              外观
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              行为
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              快捷键
            </TabsTrigger>
          </TabsList>

          {/* 终端设置 */}
          <TabsContent value="terminal" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fontSize">字体大小</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="fontSize"
                  min={8}
                  max={24}
                  step={1}
                  value={[localSettings.fontSize]}
                  onValueChange={(value) => updateSetting('fontSize', value[0])}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localSettings.fontSize}px
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontFamily">字体</Label>
              <Select
                value={localSettings.fontFamily}
                onValueChange={(value) => updateSetting('fontFamily', value)}
              >
                <SelectTrigger id="fontFamily">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                  <SelectItem value="Fira Code">Fira Code</SelectItem>
                  <SelectItem value="Cascadia Code">Cascadia Code</SelectItem>
                  <SelectItem value="Source Code Pro">Source Code Pro</SelectItem>
                  <SelectItem value="Menlo">Menlo</SelectItem>
                  <SelectItem value="Monaco">Monaco</SelectItem>
                  <SelectItem value="Consolas">Consolas</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                  <SelectItem value="monospace">System Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cursorStyle">光标样式</Label>
              <Select
                value={localSettings.cursorStyle}
                onValueChange={(value: 'block' | 'underline' | 'bar') =>
                  updateSetting('cursorStyle', value)
                }
              >
                <SelectTrigger id="cursorStyle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">方块</SelectItem>
                  <SelectItem value="underline">下划线</SelectItem>
                  <SelectItem value="bar">竖线</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cursorBlink">光标闪烁</Label>
              <Switch
                id="cursorBlink"
                checked={localSettings.cursorBlink}
                onCheckedChange={(checked) => updateSetting('cursorBlink', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rightClickPaste">右键粘贴</Label>
                <p className="text-sm text-muted-foreground">
                  在终端中右键单击即可粘贴剪贴板内容
                </p>
              </div>
              <Switch
                id="rightClickPaste"
                checked={localSettings.rightClickPaste}
                onCheckedChange={(checked) => updateSetting('rightClickPaste', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="copyOnSelect">选中复制</Label>
                <p className="text-sm text-muted-foreground">
                  选中文本时自动复制到剪贴板
                </p>
              </div>
              <Switch
                id="copyOnSelect"
                checked={localSettings.copyOnSelect}
                onCheckedChange={(checked) => updateSetting('copyOnSelect', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scrollback">回滚缓冲行数</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="scrollback"
                  min={100}
                  max={10000}
                  step={100}
                  value={[localSettings.scrollback]}
                  onValueChange={(value) => updateSetting('scrollback', value[0])}
                  className="flex-1"
                />
                <span className="w-20 text-sm text-muted-foreground">
                  {localSettings.scrollback} 行
                </span>
              </div>
            </div>
          </TabsContent>

          {/* 外观设置 */}
          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">终端主题</Label>
              <Select
                value={localSettings.theme}
                onValueChange={(value: typeof localSettings.theme) =>
                  updateSetting('theme', value)
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认（跟随应用主题）</SelectItem>
                  <SelectItem value="dark">暗色</SelectItem>
                  <SelectItem value="light">亮色</SelectItem>
                  <SelectItem value="solarized">Solarized</SelectItem>
                  <SelectItem value="dracula">Dracula</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {localSettings.theme === 'default'
                  ? '当前主题将跟随应用的明暗模式自动切换（右上角主题切换）'
                  : '当前使用固定的终端配色方案'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opacity">背景透明度</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="opacity"
                  min={50}
                  max={100}
                  step={5}
                  value={[localSettings.opacity]}
                  onValueChange={(value) => updateSetting('opacity', value[0])}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localSettings.opacity}%
                </span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backgroundImage">自定义背景图片</Label>
                <Input
                  id="backgroundImage"
                  value={localSettings.backgroundImage}
                  onChange={(e) => updateSetting('backgroundImage', e.target.value)}
                  placeholder="输入图片 URL 或留空使用默认背景"
                />
                <p className="text-xs text-muted-foreground">
                  支持 http:// 或 https:// 开头的图片链接
                </p>
              </div>

              {localSettings.backgroundImage && (
                <div className="space-y-2">
                  <Label htmlFor="backgroundImageOpacity">背景图片透明度</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="backgroundImageOpacity"
                      min={0}
                      max={100}
                      step={5}
                      value={[localSettings.backgroundImageOpacity]}
                      onValueChange={(value) => updateSetting('backgroundImageOpacity', value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {localSettings.backgroundImageOpacity}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    调整背景图片的不透明度，数值越小越透明
                  </p>
                </div>
              )}

              {localSettings.backgroundImage && (
                <div className="rounded-lg border p-4 space-y-2">
                  <Label>预览</Label>
                  <div
                    className="w-full h-32 rounded-md bg-cover bg-center bg-no-repeat border"
                    style={{
                      backgroundImage: `url(${localSettings.backgroundImage})`,
                      opacity: localSettings.backgroundImageOpacity / 100,
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* 行为设置 */}
          <TabsContent value="behavior" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxTabs">最大标签页数量</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="maxTabs"
                  min={5}
                  max={100}
                  step={5}
                  value={[localSettings.maxTabs]}
                  onValueChange={(value) => updateSetting('maxTabs', value[0])}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localSettings.maxTabs}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inactiveMinutes">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  长时间未活动提醒（分钟）
                </div>
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="inactiveMinutes"
                  min={10}
                  max={180}
                  step={10}
                  value={[localSettings.inactiveMinutes]}
                  onValueChange={(value) => updateSetting('inactiveMinutes', value[0])}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-muted-foreground">
                  {localSettings.inactiveMinutes} 分钟
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hibernateBackground">后台休眠</Label>
                <p className="text-sm text-muted-foreground">
                  隐藏的标签页将进入休眠状态以节省资源
                </p>
              </div>
              <Switch
                id="hibernateBackground"
                checked={localSettings.hibernateBackground}
                onCheckedChange={(checked) => updateSetting('hibernateBackground', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoReconnect">自动重连</Label>
                <p className="text-sm text-muted-foreground">
                  连接断开后自动尝试重新连接
                </p>
              </div>
              <Switch
                id="autoReconnect"
                checked={localSettings.autoReconnect}
                onCheckedChange={(checked) => updateSetting('autoReconnect', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="confirmBeforeClose">关闭前确认</Label>
                <p className="text-sm text-muted-foreground">
                  关闭活动连接前显示确认对话框
                </p>
              </div>
              <Switch
                id="confirmBeforeClose"
                checked={localSettings.confirmBeforeClose}
                onCheckedChange={(checked) => updateSetting('confirmBeforeClose', checked)}
              />
            </div>
          </TabsContent>

          {/* 快捷键设置 */}
          <TabsContent value="shortcuts" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="copyShortcut">复制</Label>
              <Input
                id="copyShortcut"
                value={localSettings.copyShortcut}
                onChange={(e) => updateSetting('copyShortcut', e.target.value)}
                placeholder="快捷键"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasteShortcut">粘贴</Label>
              <Input
                id="pasteShortcut"
                value={localSettings.pasteShortcut}
                onChange={(e) => updateSetting('pasteShortcut', e.target.value)}
                placeholder="快捷键"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clearShortcut">清屏</Label>
              <Input
                id="clearShortcut"
                value={localSettings.clearShortcut}
                onChange={(e) => updateSetting('clearShortcut', e.target.value)}
                placeholder="快捷键"
              />
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">提示</p>
              <p className="text-xs text-muted-foreground">
                使用组合键格式，例如：Ctrl+Shift+C、Alt+Enter 等
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存设置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
