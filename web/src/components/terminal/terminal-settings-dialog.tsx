"use client"

import { useState, useEffect, useRef } from "react"
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
  Layers,
  Activity,
  Command,
} from "lucide-react"
import { KeyboardShortcutInput } from "./keyboard-shortcut-input"
import { useTranslations } from "next-intl"

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
  monitorInterval: number // 监控数据采集间隔（秒）

  // 快捷键设置
  copyShortcut: string
  pasteShortcut: string
  clearShortcut: string

  // 补全设置
  completionEnabled: boolean
  completionTrigger: 'tab' | 'auto'
  completionAutoDelay: number
  completionMaxItems: number
  completionShowIcon: boolean
  completionShowDescription: boolean
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
  monitorInterval: 2, // 默认 2 秒采集一次
  copyShortcut: 'Ctrl+Shift+C',
  pasteShortcut: 'Ctrl+Shift+V',
  clearShortcut: 'Ctrl+L',
  completionEnabled: true,
  completionTrigger: 'auto',
  completionAutoDelay: 300,
  completionMaxItems: 10,
  completionShowIcon: true,
  completionShowDescription: true,
}

export function TerminalSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: TerminalSettingsDialogProps) {
  const t = useTranslations("terminalSettings")
  const [localSettings, setLocalSettings] = useState(settings)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 当传入的 settings 变化时，同步到 localSettings
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleSave = () => {
    // 清除防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    // 立即应用设置
    onSettingsChange(localSettings)
    onOpenChange(false)
  }

  const handleReset = () => {
    const resetSettings = defaultSettings
    setLocalSettings(resetSettings)
    // 立即应用重置的设置（不需要防抖）
    onSettingsChange(resetSettings)
  }

  const updateSetting = <K extends keyof TerminalSettings>(
    key: K,
    value: TerminalSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)

    // 使用防抖机制，延迟 300ms 后才应用设置（实时预览）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onSettingsChange(newSettings)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[680px] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="terminal" className="w-full flex-1 flex flex-col overflow-hidden px-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="terminal" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              {t("tabTerminal")}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t("tabAppearance")}
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t("tabBehavior")}
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              {t("tabShortcuts")}
            </TabsTrigger>
            <TabsTrigger value="completion" className="flex items-center gap-2">
              <Command className="h-4 w-4" />
              {t("tabCompletion")}
            </TabsTrigger>
          </TabsList>

          {/* 终端设置 */}
          <TabsContent value="terminal" className="space-y-4 overflow-y-auto scrollbar-custom pr-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fontSize">{t("fontSizeLabel")}</Label>
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
                  {t("fontSizeValue", { value: localSettings.fontSize })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontFamily">{t("fontFamilyLabel")}</Label>
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
              <Label htmlFor="cursorStyle">{t("cursorStyleLabel")}</Label>
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
                  <SelectItem value="block">{t("cursorStyleBlock")}</SelectItem>
                  <SelectItem value="underline">{t("cursorStyleUnderline")}</SelectItem>
                  <SelectItem value="bar">{t("cursorStyleBar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cursorBlink">{t("cursorBlinkLabel")}</Label>
              <Switch
                id="cursorBlink"
                checked={localSettings.cursorBlink}
                onCheckedChange={(checked) => updateSetting('cursorBlink', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rightClickPaste">{t("rightClickPasteLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("rightClickPasteDescription")}
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
                <Label htmlFor="copyOnSelect">{t("copyOnSelectLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("copyOnSelectDescription")}
                </p>
              </div>
              <Switch
                id="copyOnSelect"
                checked={localSettings.copyOnSelect}
                onCheckedChange={(checked) => updateSetting('copyOnSelect', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scrollback">{t("scrollbackLabel")}</Label>
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
                  {t("scrollbackValue", { lines: localSettings.scrollback })}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* 外观设置 */}
          <TabsContent value="appearance" className="space-y-4 overflow-y-auto scrollbar-custom pr-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="theme">{t("themeLabel")}</Label>
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
                  <SelectItem value="default">{t("themeOptionDefault")}</SelectItem>
                  <SelectItem value="dark">{t("themeOptionDark")}</SelectItem>
                  <SelectItem value="light">{t("themeOptionLight")}</SelectItem>
                  <SelectItem value="solarized">Solarized</SelectItem>
                  <SelectItem value="dracula">Dracula</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {localSettings.theme === 'default'
                  ? t("themeHelpFollowApp")
                  : t("themeHelpFixed")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opacity">{t("opacityLabel")}</Label>
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
                <Label htmlFor="backgroundImage">{t("backgroundImageLabel")}</Label>
                <Input
                  id="backgroundImage"
                  value={localSettings.backgroundImage}
                  onChange={(e) => updateSetting('backgroundImage', e.target.value)}
                  placeholder={t("backgroundImagePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("backgroundImageHelp")}
                </p>
              </div>

              {localSettings.backgroundImage && (
                <div className="space-y-2">
                  <Label htmlFor="backgroundImageOpacity">{t("backgroundImageOpacityLabel")}</Label>
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
                    {t("backgroundImageOpacityHelp")}
                  </p>
                </div>
              )}

              {localSettings.backgroundImage && (
                <div className="rounded-lg border p-4 space-y-2">
                  <Label>{t("previewLabel")}</Label>
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
          <TabsContent value="behavior" className="space-y-4 overflow-y-auto scrollbar-custom pr-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="maxTabs">{t("maxTabsLabel")}</Label>
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
                  {t("inactiveMinutesLabel")}
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
                  {t("inactiveMinutesValue", { minutes: localSettings.inactiveMinutes })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hibernateBackground">{t("hibernateLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("hibernateDescription")}
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
                <Label htmlFor="autoReconnect">{t("autoReconnectLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("autoReconnectDescription")}
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
                <Label htmlFor="confirmBeforeClose">{t("confirmBeforeCloseLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("confirmBeforeCloseDescription")}
                </p>
              </div>
              <Switch
                id="confirmBeforeClose"
                checked={localSettings.confirmBeforeClose}
                onCheckedChange={(checked) => updateSetting('confirmBeforeClose', checked)}
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="monitorInterval">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {t("monitorIntervalLabel")}
                </div>
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="monitorInterval"
                  min={1}
                  max={10}
                  step={1}
                  value={[localSettings.monitorInterval]}
                  onValueChange={(value) => updateSetting('monitorInterval', value[0])}
                  className="flex-1"
                />
                <span className="w-14 text-sm text-muted-foreground">
                  {t("monitorIntervalValue", { seconds: localSettings.monitorInterval })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("monitorIntervalHelp")}
              </p>
            </div>
          </TabsContent>

          {/* 快捷键设置 */}
          <TabsContent value="shortcuts" className="space-y-4 overflow-y-auto scrollbar-custom pr-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="copyShortcut">{t("shortcutsCopyLabel")}</Label>
              <KeyboardShortcutInput
                id="copyShortcut"
                value={localSettings.copyShortcut}
                onChange={(value) => updateSetting('copyShortcut', value)}
                placeholder={t("shortcutsPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasteShortcut">{t("shortcutsPasteLabel")}</Label>
              <KeyboardShortcutInput
                id="pasteShortcut"
                value={localSettings.pasteShortcut}
                onChange={(value) => updateSetting('pasteShortcut', value)}
                placeholder={t("shortcutsPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clearShortcut">{t("shortcutsClearLabel")}</Label>
              <KeyboardShortcutInput
                id="clearShortcut"
                value={localSettings.clearShortcut}
                onChange={(value) => updateSetting('clearShortcut', value)}
                placeholder={t("shortcutsPlaceholder")}
              />
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">{t("shortcutsTipsTitle")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t("shortcutsTipClick")}</li>
                <li>• {t("shortcutsTipModifiers")}</li>
                <li>• {t("shortcutsTipClear")}</li>
              </ul>
            </div>
          </TabsContent>

          {/* 补全设置 */}
          <TabsContent value="completion" className="space-y-4 overflow-y-auto scrollbar-custom pr-2 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="completionEnabled">{t("completionEnabledLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("completionEnabledDescription")}
                </p>
              </div>
              <Switch
                id="completionEnabled"
                checked={localSettings.completionEnabled}
                onCheckedChange={(checked) => updateSetting('completionEnabled', checked)}
              />
            </div>

            {localSettings.completionEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="completionTrigger">{t("completionTriggerLabel")}</Label>
                  <Select
                    value={localSettings.completionTrigger}
                    onValueChange={(value: 'tab' | 'auto') =>
                      updateSetting('completionTrigger', value)
                    }
                  >
                    <SelectTrigger id="completionTrigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tab">{t("completionTriggerTab")}</SelectItem>
                      <SelectItem value="auto">{t("completionTriggerAuto")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {localSettings.completionTrigger === 'tab'
                      ? t("completionTriggerHelpTab")
                      : t("completionTriggerHelpAuto")}
                  </p>
                </div>

                {localSettings.completionTrigger === 'auto' && (
                  <div className="space-y-2">
                    <Label htmlFor="completionAutoDelay">{t("completionAutoDelayLabel")}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="completionAutoDelay"
                        min={100}
                        max={1000}
                        step={50}
                        value={[localSettings.completionAutoDelay]}
                        onValueChange={(value) => updateSetting('completionAutoDelay', value[0])}
                        className="flex-1"
                      />
                      <span className="w-16 text-sm text-muted-foreground">
                        {localSettings.completionAutoDelay}ms
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("completionAutoDelayHelp")}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="completionMaxItems">{t("completionMaxItemsLabel")}</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="completionMaxItems"
                      min={5}
                      max={20}
                      step={1}
                      value={[localSettings.completionMaxItems]}
                      onValueChange={(value) => updateSetting('completionMaxItems', value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {t("completionMaxItemsValue", { count: localSettings.completionMaxItems })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("completionMaxItemsHelp")}
                  </p>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="completionShowIcon">{t("completionShowIconLabel")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("completionShowIconDescription")}
                      </p>
                    </div>
                    <Switch
                      id="completionShowIcon"
                      checked={localSettings.completionShowIcon}
                      onCheckedChange={(checked) => updateSetting('completionShowIcon', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="completionShowDescription">{t("completionShowDescriptionLabel")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("completionShowDescriptionDescription")}
                      </p>
                    </div>
                    <Switch
                      id="completionShowDescription"
                      checked={localSettings.completionShowDescription}
                      onCheckedChange={(checked) => updateSetting('completionShowDescription', checked)}
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 pb-6 px-6 shrink-0">
          <Button variant="outline" onClick={handleReset}>
            {t("btnReset")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("btnCancel")}
            </Button>
            <Button onClick={handleSave}>
              {t("btnSave")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
