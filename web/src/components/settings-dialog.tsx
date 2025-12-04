"use client"

import * as React from "react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import {
  Bell,
  Lock,
  Key,
  User,
  Loader2,
  Upload,
  X,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Info,
  Paintbrush,
  Mail,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { authApi } from "@/lib/api/auth"
import { twoFactorApi } from "@/lib/api/2fa"
import { sessionsApi, type Session } from "@/lib/api/sessions"
import { notificationsApi } from "@/lib/api/notifications"
import * as sshKeysApi from "@/lib/api/ssh-keys"
import { userAIConfigApi, type UserAIConfig, type SaveUserAIConfigRequest } from "@/lib/api/settings"
import { getEffectiveLocale, getEffectiveTimezone, formatInTimezone, saveLocaleToStorage } from "@/utils/datetime"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

/**
 * 从错误对象安全提取错误消息
 */
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error && typeof error === 'object') {
    // 检查 error.detail
    if ('detail' in error) {
      const detail = error.detail
      if (typeof detail === 'string') {
        return detail
      }
      if (detail && typeof detail === 'object') {
        if ('message' in detail && typeof detail.message === 'string') {
          return detail.message
        }
        if ('error' in detail && typeof detail.error === 'string') {
          return detail.error
        }
      }
    }
    // 检查 error.message
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
  }
  return defaultMessage
}

type SettingsSection = "profile" | "security" | "notifications" | "sshKeys" | "ai" | "about"

const settingsNavItems: { id: SettingsSection; icon: typeof User }[] = [
  { id: "profile", icon: User },
  { id: "security", icon: Lock },
  { id: "notifications", icon: Bell },
  { id: "sshKeys", icon: Key },
  { id: "ai", icon: Paintbrush },
  { id: "about", icon: Info },
]

export const SettingsDialog = React.memo(function SettingsDialog({ children }: { children: React.ReactNode }) {
  const tAccount = useTranslations("accountSettings")
  const [open, setOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<SettingsSection>("profile")

  // 使用 ClientAuthProvider 获取用户数据（dashboard 中使用）
  const { user, refreshUser, logout } = useClientAuth()

  // 使用系统配置
  const { config } = useSystemConfig()

  const effectiveLocale = React.useMemo(
    () => getEffectiveLocale(user, config),
    [user, config],
  )
  const effectiveTimezone = React.useMemo(
    () => getEffectiveTimezone(user, config),
    [user, config],
  )

  // 个人信息表单状态
  const [profileForm, setProfileForm] = React.useState({
    username: "",
    email: "",
  })
  const [profileLoading, setProfileLoading] = React.useState(false)

  // 头像上传状态
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = React.useState<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 密码修改表单状态
  const [passwordForm, setPasswordForm] = React.useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [passwordLoading, setPasswordLoading] = React.useState(false)

  // 2FA 状态
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false)
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = React.useState(false)
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = React.useState(false)
  const [disableDialogOpen, setDisableDialogOpen] = React.useState(false)
  const [qrCodeUrl, setQrCodeUrl] = React.useState("")
  const [totpSecret, setTotpSecret] = React.useState("")
  const [backupCodes, setBackupCodes] = React.useState<string[]>([])
  const [verificationCode, setVerificationCode] = React.useState("")
  const [disableCode, setDisableCode] = React.useState("")
  const [twoFactorLoading, setTwoFactorLoading] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  // 会话管理状态
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)

  // 通知设置状态
  const [notifyEmailLogin, setNotifyEmailLogin] = React.useState(true)
  const [notifyEmailAlert, setNotifyEmailAlert] = React.useState(true)
  const [notifyBrowser, setNotifyBrowser] = React.useState(true)
  const [notificationLoading, setNotificationLoading] = React.useState(false)

  // 个人偏好状态（语言与时区）
  const [preferencesForm, setPreferencesForm] = React.useState({
    language: "",
    timezone: "",
  })
  const [preferencesLoading, setPreferencesLoading] = React.useState(false)

  // SSH密钥管理状态
  const [sshKeys, setSshKeys] = React.useState<sshKeysApi.SSHKey[]>([])
  const [sshKeysLoading, setSshKeysLoading] = React.useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = React.useState(false)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [viewKeyDialogOpen, setViewKeyDialogOpen] = React.useState(false)
  const [selectedKey, setSelectedKey] = React.useState<sshKeysApi.SSHKeyWithPrivateKey | null>(null)
  const [generateForm, setGenerateForm] = React.useState({
    name: "",
    algorithm: "ed25519" as "rsa" | "ed25519",
    key_size: 2048,
  })
  const [importForm, setImportForm] = React.useState({
    name: "",
    private_key: "",
  })
  const [generateLoading, setGenerateLoading] = React.useState(false)
  const [importLoading, setImportLoading] = React.useState(false)

  // AI设置状态
  const [aiConfig, setAiConfig] = React.useState<UserAIConfig | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiForm, setAiForm] = React.useState({
    use_system_config: true,
    custom_enabled: false,
    custom_provider: "openai" as string,
    custom_api_key: "" as string,
    custom_endpoint: "" as string,
    custom_model: "" as string,
  })
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)

  // 当用户数据加载时，初始化表单
  React.useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || "",
        email: user.email || "",
      })
      // 设置头像预览（清除之前的文件选择）
      setAvatarFile(null)
      setAvatarPreview(user.avatar || "")
      // 初始化 2FA 状态
      setTwoFactorEnabled(user.two_factor_enabled || false)
      // 初始化通知设置
      setNotifyEmailLogin(user.notify_email_login ?? true)
      setNotifyEmailAlert(user.notify_email_alert ?? true)
      setNotifyBrowser(user.notify_browser ?? true)
      // 初始化个人偏好（优先使用用户配置，其次使用系统默认配置）
      setPreferencesForm({
        language: user.language || config?.default_language || "zh-CN",
        timezone: user.timezone || config?.default_timezone || "Asia/Shanghai",
      })
    }
  }, [user, config])

  // 当切换到账户安全标签时加载会话数据
  React.useEffect(() => {
    if (activeSection === "security" && open) {
      loadSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, open])

  // 当切换到SSH密钥标签时加载密钥数据
  React.useEffect(() => {
    if (activeSection === "sshKeys" && open) {
      loadSSHKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, open])

  // 当切换到AI设置标签时加载AI配置
  React.useEffect(() => {
    if (activeSection === "ai" && open) {
      loadAIConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, open])

  // 处理头像文件选择
  const handleAvatarSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error(tAccount("avatarFileTypeError"))
      return
    }

    // 验证文件大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tAccount("avatarFileSizeError"))
      return
    }

    setAvatarFile(file)

    // 生成预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // 清空头像预览（不立即保存）
  const handleRemoveAvatar = React.useCallback(() => {
    setAvatarFile(null)
    setAvatarPreview("")
  }, [])

  // 生成 DiceBear 头像
  const handleGenerateDiceBearAvatar = React.useCallback(() => {
    // 使用随机种子生成不同的头像
    const randomSeed = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const dicebearUrl = `https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${randomSeed}`

    // 获取 SVG 并转换为 base64
    fetch(dicebearUrl)
      .then(response => response.text())
      .then(svgText => {
        // 将 SVG 转换为 data URL
        const base64 = btoa(unescape(encodeURIComponent(svgText)))
        const dataUrl = `data:image/svg+xml;base64,${base64}`
        setAvatarPreview(dataUrl)
        setAvatarFile(null)
        toast.success(tAccount("avatarGenerateSuccess"))
      })
      .catch(error => {
        console.error("Failed to generate avatar:", error)
        toast.error(tAccount("avatarGenerateFailed"))
      })
  }, [tAccount])

  // 压缩图片
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // 计算缩放比例（保持宽高比，缩放到正方形）
          const size = Math.min(maxWidth, maxHeight)
          if (width > height) {
            if (width > size) {
              height = (height * size) / width
              width = size
            }
          } else {
            if (height > size) {
              width = (width * size) / height
              height = size
            }
          }

          canvas.width = width
          canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }

          // 绘制白色背景（避免透明背景转 JPEG 变黑）
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为 base64（JPEG 格式，质量 0.6 降低文件大小）
          const base64 = canvas.toDataURL('image/jpeg', 0.6)

          // 检查 base64 大小（如果超过 500KB 则进一步降低质量）
          if (base64.length > 500 * 1024) {
            const smallerBase64 = canvas.toDataURL('image/jpeg', 0.4)
            resolve(smallerBase64)
          } else {
            resolve(base64)
          }
        }
        img.onerror = () => reject(new Error("Image load failed"))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error("File read failed"))
      reader.readAsDataURL(file)
    })
  }

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    // 当对话框打开时，重新初始化头像预览
    if (newOpen && user) {
      setAvatarPreview(user.avatar || "")
      setAvatarFile(null)
      // 重新同步个人偏好（避免系统配置或用户信息变化后未刷新）
      setPreferencesForm({
        language: user.language || config?.default_language || "zh-CN",
        timezone: user.timezone || config?.default_timezone || "Asia/Shanghai",
      })
    }
  }, [user, config])

  const handleSectionChange = React.useCallback((section: SettingsSection) => {
    setActiveSection(section)
  }, [])

  const getSectionLabel = React.useCallback(
    (section: SettingsSection) => {
      switch (section) {
        case "profile":
          return tAccount("navProfile")
        case "security":
          return tAccount("navSecurity")
        case "notifications":
          return tAccount("navNotifications")
        case "sshKeys":
          return tAccount("navSSHKeys")
        case "ai":
          return tAccount("aiTitle")
        case "about":
          return tAccount("navAbout")
        default:
          return ""
      }
    },
    [tAccount]
  )

  // 保存个人信息
  const handleSaveProfile = React.useCallback(async () => {

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (profileForm.email && !emailRegex.test(profileForm.email)) {
      toast.error(tAccount("toastInvalidEmail"))
      return
    }

    setProfileLoading(true)
    try {
      let finalAvatar = avatarPreview

      // 如果选择了新图片文件，需要压缩
      if (avatarFile) {
        finalAvatar = await compressImage(avatarFile, 128, 128)
      }

      // 保存个人信息和头像
      await authApi.updateProfile({
        username: profileForm.username,
        email: profileForm.email,
        avatar: finalAvatar, // 包含头像数据
      })
      await refreshUser()
      setAvatarFile(null) // 清除文件选择状态
      toast.success(tAccount("toastProfileSaved"))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("toastSaveFailed")))
    } finally {
      setProfileLoading(false)
    }
  }, [profileForm, avatarFile, avatarPreview, refreshUser, tAccount])

  // 保存个人偏好（语言与时区）
  const handleSavePreferences = React.useCallback(async () => {
    if (!preferencesForm.language) {
      toast.error(tAccount("toastLanguageRequired"))
      return
    }
    if (!preferencesForm.timezone) {
      toast.error(tAccount("toastTimezoneRequired"))
      return
    }

    setPreferencesLoading(true)
    try {
      // 立即保存到 localStorage，确保页面刷新时能立即使用
      if (preferencesForm.language === "zh-CN" || preferencesForm.language === "en-US") {
        saveLocaleToStorage(preferencesForm.language)
      }

      await authApi.updateProfile({
        language: preferencesForm.language,
        timezone: preferencesForm.timezone,
      })
      await refreshUser()
      toast.success(tAccount("toastPreferencesSaved"))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("toastSaveFailed")))
    } finally {
      setPreferencesLoading(false)
    }
  }, [preferencesForm, refreshUser, tAccount])

  // 修改密码
  const handleChangePassword = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证新密码
    if (passwordForm.new_password.length < 8) {
      toast.error(tAccount("securityPasswordTooShort"))
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(tAccount("securityPasswordMismatch"))
      return
    }

    setPasswordLoading(true)
    try {
      await authApi.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      toast.success(tAccount("securityPasswordChanged"))

      // 清空表单
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      })

      // 关闭对话框
      setOpen(false)

      // 2秒后自动登出
      setTimeout(() => {
        logout()
      }, 2000)
    } catch (error: unknown) {
      // 获取错误消息并进行特殊翻译
      let errorMessage = getErrorMessage(error, tAccount("securityPasswordChangeFailed"))

      // 翻译常见的英文错误信息
      if (errorMessage === 'invalid old password') {
        errorMessage = tAccount("securityPasswordOldIncorrect")
      } else if (errorMessage.includes('password must be at least')) {
        errorMessage = tAccount("securityPasswordLengthInsufficient")
      }

      toast.error(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }, [passwordForm, logout, tAccount])

  // 生成 2FA Secret（第一步）
  const handleGenerate2FA = React.useCallback(async () => {
    setTwoFactorLoading(true)
    try {
      const response = await twoFactorApi.generateSecret()
      setQrCodeUrl(response.qr_code_url)
      setTotpSecret(response.secret)
      setQrCodeDialogOpen(true)
      toast.success(tAccount("security2faScanQrToast"))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("security2faGenerateFailed")))
    } finally {
      setTwoFactorLoading(false)
    }
  }, [tAccount])

  // 启用 2FA（第二步：验证代码）
  const handleEnable2FA = React.useCallback(async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error(tAccount("security2faVerifyCodeRequired"))
      return
    }

    setTwoFactorLoading(true)
    try {
      const response = await twoFactorApi.enable(verificationCode)
      setBackupCodes(response.backup_codes)
      setQrCodeDialogOpen(false)
      setBackupCodesDialogOpen(true)
      setVerificationCode("")
      await refreshUser()
      toast.success(tAccount("security2faEnabledToast"))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("security2faEnableFailed")))
    } finally {
      setTwoFactorLoading(false)
    }
  }, [verificationCode, refreshUser, tAccount])

  // 监听启用验证码输入，自动提交
  React.useEffect(() => {
    if (verificationCode.length === 6 && qrCodeDialogOpen && !twoFactorLoading) {
      handleEnable2FA()
    }
  }, [verificationCode, qrCodeDialogOpen, twoFactorLoading, handleEnable2FA])

  // 禁用 2FA
  const handleDisable2FA = React.useCallback(async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error(tAccount("security2faVerifyCodeRequired"))
      return
    }

    setTwoFactorLoading(true)
    try {
      await twoFactorApi.disable(disableCode)
      setDisableDialogOpen(false)
      setDisableCode("")
      await refreshUser()
      toast.success(tAccount("security2faDisabledToast"))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("security2faDisableFailed")))
    } finally {
      setTwoFactorLoading(false)
    }
  }, [disableCode, refreshUser, tAccount])

  // 监听禁用验证码输入，自动提交
  React.useEffect(() => {
    if (disableCode.length === 6 && disableDialogOpen && !twoFactorLoading) {
      handleDisable2FA()
    }
  }, [disableCode, disableDialogOpen, twoFactorLoading, handleDisable2FA])

  // 复制备份码
  const handleCopyCode = React.useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success(
      tAccount("copyToastSuccess", { label: tAccount("security2faBackupCodeLabel") })
    )
    setTimeout(() => setCopiedCode(null), 2000)
  }, [tAccount])

  // 复制所有备份码
  const handleCopyAllCodes = React.useCallback(() => {
    const allCodes = backupCodes.join("\n")
    navigator.clipboard.writeText(allCodes)
    toast.success(
      tAccount("copyToastSuccess", { label: tAccount("security2faBackupAllCodesLabel") })
    )
  }, [backupCodes, tAccount])

  // 加载会话列表
  const loadSessions = React.useCallback(async () => {
    setSessionsLoading(true)
    try {
      const response = await sessionsApi.list()
      setSessions(response.sessions || [])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("securitySessionsLoadFailed")))
    } finally {
      setSessionsLoading(false)
    }
  }, [tAccount])

  // 撤销单个会话
  const handleRevokeSession = React.useCallback(async (sessionId: string) => {
    try {
      await sessionsApi.revoke(sessionId)
      toast.success(tAccount("securitySessionsRevokeSuccess"))
      // 本地移除已撤销的会话，避免整列表重新加载
      setSessions(prev => prev.filter(session => session.id !== sessionId))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("securitySessionsRevokeFailed")))
    }
  }, [tAccount])

  // 撤销所有其他会话
  const handleRevokeAllOtherSessions = React.useCallback(async () => {
    try {
      await sessionsApi.revokeAllOthers()
      toast.success(tAccount("securitySessionsRevokeAllOthersSuccess"))
      // 仅保留当前会话，其它会话本地移除
      setSessions(prev => prev.filter(session => session.is_current))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("securitySessionsRevokeAllFailed")))
    }
  }, [tAccount])

  // 更新通知设置
  const handleUpdateNotification = React.useCallback(
    async (field: "email_login" | "email_alert" | "browser", value: boolean) => {
      setNotificationLoading(true)
      try {
        await notificationsApi.update({ [field]: value })
        toast.success(tAccount("notificationsUpdateSuccess"))
        // 刷新用户数据
        await refreshUser()
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, tAccount("notificationsUpdateFailed")))
        // 恢复原值
        if (field === "email_login") setNotifyEmailLogin(!value)
        if (field === "email_alert") setNotifyEmailAlert(!value)
        if (field === "browser") setNotifyBrowser(!value)
      } finally {
        setNotificationLoading(false)
      }
    },
    [refreshUser, tAccount]
  )

  // 加载SSH密钥列表
  const loadSSHKeys = React.useCallback(async () => {
    setSshKeysLoading(true)
    try {
      const keys = await sshKeysApi.getSSHKeys()
      setSshKeys(keys)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("sshKeysLoadFailed")))
    } finally {
      setSshKeysLoading(false)
    }
  }, [tAccount])

  // 生成SSH密钥
  const handleGenerateKey = React.useCallback(async () => {
    if (!generateForm.name.trim()) {
      toast.error(tAccount("sshKeyToastNameRequired"))
      return
    }

    setGenerateLoading(true)
    try {
      const newKey = await sshKeysApi.generateSSHKey(generateForm)
      toast.success(tAccount("sshKeyToastGenerateSuccess"))
      setSelectedKey(newKey)
      setViewKeyDialogOpen(true)
      setGenerateDialogOpen(false)
      setGenerateForm({ name: "", algorithm: "ed25519", key_size: 2048 })
      loadSSHKeys() // 刷新列表
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("sshKeyToastGenerateFailed")))
    } finally {
      setGenerateLoading(false)
    }
  }, [generateForm, loadSSHKeys, tAccount])

  // 导入SSH密钥
  const handleImportKey = React.useCallback(async () => {
    if (!importForm.name.trim()) {
      toast.error(tAccount("sshKeyToastNameRequired"))
      return
    }
    if (!importForm.private_key.trim()) {
      toast.error(tAccount("sshKeyToastPrivateKeyRequired"))
      return
    }

    setImportLoading(true)
    try {
      const newKey = await sshKeysApi.importSSHKey(importForm)
      toast.success(tAccount("sshKeyToastImportSuccess"))
      setSelectedKey(newKey)
      setViewKeyDialogOpen(true)
      setImportDialogOpen(false)
      setImportForm({ name: "", private_key: "" })
      loadSSHKeys() // 刷新列表
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("sshKeyToastImportFailed")))
    } finally {
      setImportLoading(false)
    }
  }, [importForm, loadSSHKeys, tAccount])

  // 删除SSH密钥
  const handleDeleteKey = React.useCallback(async (keyId: number, keyName: string) => {
    if (!confirm(tAccount("sshKeyConfirmDelete", { name: keyName }))) {
      return
    }

    try {
      await sshKeysApi.deleteSSHKey(keyId)
      toast.success(tAccount("sshKeyToastDeleteSuccess"))
      loadSSHKeys() // 刷新列表
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("sshKeyToastDeleteFailed")))
    }
  }, [loadSSHKeys, tAccount])

  // 复制到剪贴板
  const handleCopyToClipboard = React.useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(tAccount("copyToastSuccess", { label }))
    } catch {
      toast.error(tAccount("copyToastFailed"))
    }
  }, [tAccount])

  // 加载AI配置
  const loadAIConfig = React.useCallback(async () => {
    setAiLoading(true)
    try {
      const config = await userAIConfigApi.getUserAIConfig()
      setAiConfig(config)
      setAiForm({
        use_system_config: config.use_system_config,
        custom_enabled: config.custom_enabled,
        custom_provider: config.custom_provider || "openai",
        custom_api_key: "", // 不从服务器获取API密钥
        custom_endpoint: config.custom_endpoint || "",
        custom_model: config.custom_model || "",
      })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("aiLoadFailed")))
    } finally {
      setAiLoading(false)
    }
  }, [tAccount])

  // 保存AI配置
  const handleSaveAIConfig = React.useCallback(async () => {
    // 如果使用自定义配置，验证必填字段
    if (!aiForm.use_system_config && aiForm.custom_enabled) {
      if (!aiForm.custom_api_key) {
        toast.error("请输入 API 密钥")
        return
      }
      if (!aiForm.custom_model) {
        toast.error("请输入模型名称")
        return
      }
    }

    setAiLoading(true)
    try {
      const request: SaveUserAIConfigRequest = {
        use_system_config: aiForm.use_system_config,
        custom_enabled: aiForm.custom_enabled,
        custom_provider: aiForm.custom_provider,
        custom_api_key: aiForm.custom_api_key,
        custom_endpoint: aiForm.custom_endpoint,
        custom_model: aiForm.custom_model,
      }
      await userAIConfigApi.saveUserAIConfig(request)
      toast.success(tAccount("aiSaveSuccess"))
      loadAIConfig() // 重新加载配置
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("aiSaveFailed")))
    } finally {
      setAiLoading(false)
    }
  }, [aiForm, loadAIConfig, tAccount])

  // 重置AI配置
  const handleResetAIConfig = React.useCallback(async () => {
    setAiLoading(true)
    try {
      await userAIConfigApi.deleteUserAIConfig()
      toast.success(tAccount("aiResetSuccess"))
      setShowResetConfirm(false)
      loadAIConfig() // 重新加载配置
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, tAccount("aiResetFailed")))
    } finally {
      setAiLoading(false)
    }
  }, [loadAIConfig, tAccount])

  const navItems = React.useMemo(() => settingsNavItems, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">
          {tAccount("dialogTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {tAccount("dialogDescription")}
        </DialogDescription>
        <SidebarProvider>
          <Sidebar collapsible="none" className="hidden md:flex md:w-44 lg:w-48 border-r shrink-0">
            <SidebarContent className="py-4">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.id === activeSection}
                          onClick={() => handleSectionChange(item.id)}
                        >
                          <button>
                            <item.icon />
                            <span>{getSectionLabel(item.id)}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex min-h-[400px] max-h-[600px] flex-1 flex-col overflow-hidden">
            {/* 移动端导航 */}
            <div className="md:hidden border-b px-4 py-3">
              <Select
                value={activeSection}
                onValueChange={(value: SettingsSection) => handleSectionChange(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tAccount("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {navItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{getSectionLabel(item.id)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="space-y-6 p-6">
                <h3 className="text-lg font-semibold">
                  {getSectionLabel(activeSection)}
                </h3>
                {activeSection === "profile" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("avatarTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("avatarDescription")}
                      </p>
                      <div className="flex items-center gap-4">
                        {/* 头像显示 - 可点击上传 */}
                        <div
                          className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border cursor-pointer group"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {avatarPreview ? (
                            <Image
                              src={avatarPreview}
                              alt={tAccount("avatarPreviewAlt")}
                              width={80}
                              height={80}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-semibold">
                              {user?.username?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )}
                          {/* 悬浮时显示上传图标 */}
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="h-6 w-6 text-white" />
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarSelect}
                              className="hidden"
                            />
                            {avatarPreview && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRemoveAvatar}
                              >
                                <X className="h-4 w-4 mr-1" />
                                {tAccount("avatarRemove")}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateDiceBearAvatar}
                            >
                              <Paintbrush className="h-4 w-4 mr-1" />
                              {tAccount("avatarGenerate")}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tAccount("avatarSupportHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("basicInfoTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("basicInfoDescription")}
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">
                            {tAccount("usernameLabel")}
                          </Label>
                          <Input
                            id="username"
                            placeholder={tAccount("usernamePlaceholder")}
                            value={profileForm.username}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">
                            {tAccount("usernameHint")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">
                            {tAccount("emailLabel")}
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={tAccount("emailPlaceholder")}
                            value={profileForm.email}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <Button
                          className="mt-4"
                          onClick={handleSaveProfile}
                          disabled={profileLoading}
                        >
                          {profileLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {tAccount("saveProfileButton")}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("preferencesTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("preferencesDescription")}
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="language">
                            {tAccount("languageLabel")}
                          </Label>
                          <Select
                            value={preferencesForm.language}
                            onValueChange={(value) =>
                              setPreferencesForm((prev) => ({ ...prev, language: value }))
                            }
                          >
                            <SelectTrigger id="language" className="w-full">
                              <SelectValue placeholder={tAccount("languagePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zh-CN">
                                {tAccount("languageOptionZhCN")}
                              </SelectItem>
                              <SelectItem value="en-US">
                                {tAccount("languageOptionEnUS")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {tAccount("languageHint")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">
                            {tAccount("timezoneLabel")}
                          </Label>
                          <Select
                            value={preferencesForm.timezone}
                            onValueChange={(value) =>
                              setPreferencesForm((prev) => ({ ...prev, timezone: value }))
                            }
                          >
                            <SelectTrigger id="timezone" className="w-full">
                              <SelectValue placeholder={tAccount("timezonePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Asia/Shanghai">
                                {tAccount("timezoneOptionAsiaShanghai")}
                              </SelectItem>
                              <SelectItem value="Asia/Tokyo">
                                {tAccount("timezoneOptionAsiaTokyo")}
                              </SelectItem>
                              <SelectItem value="Asia/Hong_Kong">
                                {tAccount("timezoneOptionAsiaHongKong")}
                              </SelectItem>
                              <SelectItem value="America/New_York">
                                {tAccount("timezoneOptionAmericaNewYork")}
                              </SelectItem>
                              <SelectItem value="America/Los_Angeles">
                                {tAccount("timezoneOptionAmericaLosAngeles")}
                              </SelectItem>
                              <SelectItem value="Europe/London">
                                {tAccount("timezoneOptionEuropeLondon")}
                              </SelectItem>
                              <SelectItem value="Europe/Paris">
                                {tAccount("timezoneOptionEuropeParis")}
                              </SelectItem>
                              <SelectItem value="UTC">
                                {tAccount("timezoneOptionUTC")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {tAccount("timezoneHint")}
                          </p>
                        </div>
                        <Button
                          className="mt-2"
                          onClick={handleSavePreferences}
                          disabled={preferencesLoading}
                        >
                          {preferencesLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {tAccount("savePreferencesButton")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "security" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("securityPasswordTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("securityPasswordDescription")}
                      </p>
                      <form className="space-y-4" onSubmit={handleChangePassword}>
                        <div className="space-y-2">
                          <Label htmlFor="current-password">
                            {tAccount("securityCurrentPasswordLabel")}
                          </Label>
                          <Input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder={tAccount("securityCurrentPasswordPlaceholder")}
                            value={passwordForm.old_password}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">
                            {tAccount("securityNewPasswordLabel")}
                          </Label>
                          <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder={tAccount("securityNewPasswordPlaceholder")}
                            value={passwordForm.new_password}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                            }
                            required
                            minLength={8}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">
                            {tAccount("securityConfirmPasswordLabel")}
                          </Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder={tAccount("securityConfirmPasswordPlaceholder")}
                            value={passwordForm.confirm_password}
                            onChange={(e) =>
                              setPasswordForm((prev) => ({
                                ...prev,
                                confirm_password: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <Button
                          type="submit"
                          className="mt-4"
                          disabled={passwordLoading}
                        >
                          {passwordLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {tAccount("securitySavePasswordButton")}
                        </Button>
                      </form>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("security2faTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("security2faDescription")}
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="2fa">
                              {tAccount("security2faStatusLabel")}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {twoFactorEnabled
                                ? tAccount("security2faStatusEnabled")
                                : tAccount("security2faStatusDisabled")}
                            </p>
                          </div>
                          <Switch
                            id="2fa"
                            checked={twoFactorEnabled}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleGenerate2FA()
                              } else {
                                setDisableDialogOpen(true)
                              }
                            }}
                            disabled={twoFactorLoading}
                          />
                        </div>
                        {!twoFactorEnabled && (
                          <p className="text-xs text-muted-foreground">
                            {tAccount("security2faRecommendApps")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">
                            {tAccount("securitySessionsTitle")}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {tAccount("securitySessionsDescription")}
                          </p>
                        </div>
                        {sessions.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRevokeAllOtherSessions}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            {tAccount("securitySessionsRevokeAllButton")}
                          </Button>
                        )}
                      </div>

                      {sessionsLoading ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="text-center p-8 text-sm text-muted-foreground">
                          {tAccount("securitySessionsEmpty")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {sessions.map((session) => {
                            const DeviceIcon =
                              session.device_type === "mobile"
                                ? Smartphone
                                : session.device_type === "tablet"
                                ? Tablet
                                : Monitor

                            return (
                              <div
                                key={session.id}
                                className={`flex justify-between items-start p-3 bg-background rounded-lg border ${
                                  session.is_current ? "border-primary/50 bg-primary/5" : ""
                                }`}
                              >
                                <div className="flex gap-3 flex-1 min-w-0">
                                  <DeviceIcon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-sm font-medium truncate">
                                        {session.device_name ||
                                          tAccount("securitySessionsUnknownDevice")}
                                      </p>
                                      {session.is_current && (
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                                          {tAccount("securitySessionsCurrentTag")}
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-0.5 text-xs text-muted-foreground">
                                      <p className="truncate">
                                        {session.ip_address}
                                        {session.location && ` · ${session.location}`}
                                      </p>
                                      <p>
                                        {tAccount("securitySessionsLastActive", {
                                          time: formatInTimezone(
                                            session.last_activity,
                                            { second: "2-digit" },
                                            effectiveLocale,
                                            effectiveTimezone,
                                          ),
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {!session.is_current && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevokeSession(session.id)}
                                    className="text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                                  >
                                    <LogOut className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeSection === "notifications" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("notificationsOverviewTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("notificationsOverviewDescription")}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {tAccount("notificationsEmailCardTitle")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {notifyEmailLogin || notifyEmailAlert
                                ? tAccount("notificationsStatusPartial")
                                : tAccount("notificationsStatusDisabled")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {tAccount("notificationsBrowserCardTitle")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {notifyBrowser
                                ? tAccount("notificationsStatusEnabled")
                                : tAccount("notificationsStatusDisabled")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("notificationsEmailSectionTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("notificationsEmailSectionDescription")}
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-login">
                              {tAccount("notificationsEmailLoginLabel")}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {tAccount("notificationsEmailLoginDescription")}
                            </p>
                          </div>
                          <Switch
                            id="email-login"
                            checked={notifyEmailLogin}
                            onCheckedChange={(checked) => {
                              setNotifyEmailLogin(checked)
                              handleUpdateNotification("email_login", checked)
                            }}
                            disabled={notificationLoading}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-alerts">
                              {tAccount("notificationsEmailAlertLabel")}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {tAccount("notificationsEmailAlertDescription")}
                            </p>
                          </div>
                          <Switch
                            id="email-alerts"
                            checked={notifyEmailAlert}
                            onCheckedChange={(checked) => {
                              setNotifyEmailAlert(checked)
                              handleUpdateNotification("email_alert", checked)
                            }}
                            disabled={notificationLoading}
                          />
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          {tAccount("notificationsEmailServerHint")}
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("notificationsBrowserSectionTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("notificationsBrowserSectionDescription")}
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="browser-notifications">
                              {tAccount("notificationsBrowserToggleLabel")}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {tAccount("notificationsBrowserToggleDescription")}
                            </p>
                          </div>
                          <Switch
                            id="browser-notifications"
                            checked={notifyBrowser}
                            onCheckedChange={(checked) => {
                              setNotifyBrowser(checked)
                              handleUpdateNotification("browser", checked)
                            }}
                            disabled={notificationLoading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("notificationsOtherChannelsTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("notificationsOtherChannelsDescription")}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <p className="text-sm font-medium">
                              {tAccount("notificationsDingtalkTitle")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tAccount("notificationsDingtalkDescription")}
                          </p>
                        </div>
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <p className="text-sm font-medium">
                              {tAccount("notificationsWecomTitle")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tAccount("notificationsWecomDescription")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "sshKeys" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium">
                            {tAccount("sshSectionTitle")}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {tAccount("sshSectionDescription")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGenerateDialogOpen(true)}
                          >
                            {tAccount("sshGenerateButton")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImportDialogOpen(true)}
                          >
                            {tAccount("sshImportButton")}
                          </Button>
                        </div>
                      </div>

                      {sshKeysLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : sshKeys.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Key className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">
                            {tAccount("sshEmptyTitle")}
                          </p>
                          <p className="text-xs">
                            {tAccount("sshEmptyDescription")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {sshKeys.map((key) => (
                            <div key={key.id} className="p-3 bg-background rounded border">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium">{key.name}</p>
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                      {key.algorithm.toUpperCase()}
                                      {key.key_size ? ` ${key.key_size}` : ""}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground font-mono truncate">
                                    {key.fingerprint}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tAccount("sshCreatedAt", {
                                      date: formatInTimezone(
                                        key.created_at,
                                        { year: "numeric", month: "2-digit", day: "2-digit" },
                                        effectiveLocale,
                                        effectiveTimezone,
                                      ),
                                    })}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleCopyToClipboard(
                                        key.public_key,
                                        tAccount("sshPublicKeyLabel"),
                                      )
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteKey(key.id, key.name)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 生成密钥对话框 */}
                    <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogTitle>{tAccount("sshGenerateDialogTitle")}</DialogTitle>
                        <DialogDescription>
                          {tAccount("sshGenerateDialogDescription")}
                        </DialogDescription>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="gen-name">
                              {tAccount("sshGenerateNameLabel")}
                            </Label>
                            <Input
                              id="gen-name"
                              placeholder={tAccount("sshGenerateNamePlaceholder")}
                              value={generateForm.name}
                              onChange={(e) =>
                                setGenerateForm({ ...generateForm, name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gen-algorithm">
                              {tAccount("sshGenerateAlgorithmLabel")}
                            </Label>
                            <Select
                              value={generateForm.algorithm}
                              onValueChange={(value: "rsa" | "ed25519") =>
                                setGenerateForm({ ...generateForm, algorithm: value })
                              }
                            >
                              <SelectTrigger id="gen-algorithm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ed25519">
                                  {tAccount("sshGenerateAlgorithmOptionEd25519")}
                                </SelectItem>
                                <SelectItem value="rsa">
                                  {tAccount("sshGenerateAlgorithmOptionRsa")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {tAccount("sshGenerateAlgorithmEd25519Hint")}
                            </p>
                          </div>
                          {generateForm.algorithm === "rsa" && (
                            <div className="space-y-2">
                              <Label htmlFor="gen-keysize">
                                {tAccount("sshGenerateKeySizeLabel")}
                              </Label>
                              <Select
                                value={generateForm.key_size.toString()}
                                onValueChange={(value) =>
                                  setGenerateForm({
                                    ...generateForm,
                                    key_size: parseInt(value),
                                  })
                                }
                              >
                                <SelectTrigger id="gen-keysize">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2048">
                                    {tAccount("sshGenerateKeySizeOption2048")}
                                  </SelectItem>
                                  <SelectItem value="4096">
                                    {tAccount("sshGenerateKeySizeOption4096")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setGenerateDialogOpen(false)}
                              disabled={generateLoading}
                            >
                              {tAccount("sshDialogCancel")}
                            </Button>
                            <Button onClick={handleGenerateKey} disabled={generateLoading}>
                              {generateLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              {tAccount("sshGenerateSubmit")}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* 导入密钥对话框 */}
                    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogTitle>{tAccount("sshImportDialogTitle")}</DialogTitle>
                        <DialogDescription>
                          {tAccount("sshImportDialogDescription")}
                        </DialogDescription>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="imp-name">
                              {tAccount("sshImportNameLabel")}
                            </Label>
                            <Input
                              id="imp-name"
                              placeholder={tAccount("sshImportNamePlaceholder")}
                              value={importForm.name}
                              onChange={(e) =>
                                setImportForm({ ...importForm, name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="imp-key">
                              {tAccount("sshImportPrivateKeyLabel")}
                            </Label>
                            <textarea
                              id="imp-key"
                              className="w-full min-h-[200px] px-3 py-2 text-sm rounded-md border border-input bg-background font-mono"
                              placeholder={tAccount("sshImportPrivateKeyPlaceholder")}
                              value={importForm.private_key}
                              onChange={(e) =>
                                setImportForm({
                                  ...importForm,
                                  private_key: e.target.value,
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              {tAccount("sshImportPrivateKeyHint")}
                            </p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setImportDialogOpen(false)}
                              disabled={importLoading}
                            >
                              {tAccount("sshDialogCancel")}
                            </Button>
                            <Button onClick={handleImportKey} disabled={importLoading}>
                              {importLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              {tAccount("sshImportSubmit")}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* 查看密钥对话框（首次生成/导入后显示） */}
                    <Dialog open={viewKeyDialogOpen} onOpenChange={setViewKeyDialogOpen}>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogTitle>{tAccount("sshViewDialogTitle")}</DialogTitle>
                        <DialogDescription>
                          {tAccount("sshViewDialogDescription")}
                        </DialogDescription>
                        {selectedKey && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label>{tAccount("sshViewPublicKeyLabel")}</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleCopyToClipboard(
                                      selectedKey.public_key,
                                      tAccount("sshPublicKeyLabel"),
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  {tAccount("sshCopyButtonLabel")}
                                </Button>
                              </div>
                              <textarea
                                className="w-full min-h-[80px] px-3 py-2 text-xs rounded-md border border-input bg-background font-mono"
                                value={selectedKey.public_key}
                                readOnly
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label>{tAccount("sshViewPrivateKeyLabel")}</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleCopyToClipboard(
                                      selectedKey.private_key,
                                      tAccount("sshPrivateKeyLabel"),
                                    )
                                  }
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  {tAccount("sshCopyButtonLabel")}
                                </Button>
                              </div>
                              <textarea
                                className="w-full min-h-[200px] px-3 py-2 text-xs rounded-md border border-input bg-background font-mono"
                                value={selectedKey.private_key}
                                readOnly
                              />
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-3">
                              <p className="text-sm text-amber-800 dark:text-amber-200">
                                {tAccount("sshViewPrivateKeyWarning")}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  setViewKeyDialogOpen(false)
                                  setSelectedKey(null)
                                }}
                              >
                                {tAccount("sshViewIHaveSavedButton")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                {activeSection === "ai" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("aiTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("aiDescription")}
                      </p>

                      {aiLoading || !aiConfig ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* 使用系统配置选项 */}
                          <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                            <div className="space-y-1">
                              <Label htmlFor="use-system-config">
                                {tAccount("aiUseSystemConfigLabel")}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {tAccount("aiUseSystemConfigDescription")}
                              </p>
                            </div>
                            <Switch
                              id="use-system-config"
                              checked={aiForm.use_system_config}
                              onCheckedChange={(checked) => {
                                setAiForm(prev => ({
                                  ...prev,
                                  use_system_config: checked,
                                  custom_enabled: !checked,
                                }))
                              }}
                            />
                          </div>

                          {/* 自定义配置 */}
                          {!aiForm.use_system_config && (
                            <div className="space-y-4 p-4 bg-background rounded-lg border">
                              <div className="space-y-2">
                                <Label htmlFor="ai-provider">
                                  {tAccount("aiProviderLabel")}
                                </Label>
                                <Select
                                  value={aiForm.custom_provider}
                                  onValueChange={(value) =>
                                    setAiForm(prev => ({ ...prev, custom_provider: value }))
                                  }
                                >
                                  <SelectTrigger id="ai-provider">
                                    <SelectValue placeholder={tAccount("aiProviderPlaceholder")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="openai">
                                      {tAccount("aiProviderOpenAI")}
                                    </SelectItem>
                                    <SelectItem value="anthropic">
                                      {tAccount("aiProviderAnthropic")}
                                    </SelectItem>
                                    <SelectItem value="azure">
                                      {tAccount("aiProviderAzure")}
                                    </SelectItem>
                                    <SelectItem value="custom">
                                      {tAccount("aiProviderCustom")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="ai-api-key">
                                  {tAccount("aiAPIKeyLabel")} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="ai-api-key"
                                  type="password"
                                  placeholder={tAccount("aiAPIKeyPlaceholder")}
                                  value={aiForm.custom_api_key || ""}
                                  onChange={(e) =>
                                    setAiForm(prev => ({ ...prev, custom_api_key: e.target.value }))
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  {aiConfig?.has_api_key
                                    ? tAccount("aiAPIKeySet")
                                    : tAccount("aiAPIKeyNotSet")}
                                  {" · "}
                                  {tAccount("aiAPIKeyHint")}
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="ai-endpoint">
                                  {tAccount("aiEndpointLabel")}
                                </Label>
                                <Input
                                  id="ai-endpoint"
                                  placeholder={tAccount("aiEndpointPlaceholder")}
                                  value={aiForm.custom_endpoint || ""}
                                  onChange={(e) =>
                                    setAiForm(prev => ({ ...prev, custom_endpoint: e.target.value }))
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  {tAccount("aiEndpointHint")}
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="ai-model">
                                  {tAccount("aiModelLabel")} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  id="ai-model"
                                  placeholder={tAccount("aiModelPlaceholder")}
                                  value={aiForm.custom_model || ""}
                                  onChange={(e) =>
                                    setAiForm(prev => ({ ...prev, custom_model: e.target.value }))
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  {tAccount("aiModelHint")}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveAIConfig}
                              disabled={aiLoading}
                            >
                              {aiLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              {tAccount("aiSaveButton")}
                            </Button>
                            {!aiForm.use_system_config && (
                              <Button
                                variant="outline"
                                onClick={() => setShowResetConfirm(true)}
                                disabled={aiLoading}
                              >
                                {tAccount("aiResetButton")}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeSection === "about" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-6 text-center">
                      <div className="mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-3">
                          <Image
                            src={config?.system_logo || "/logo.svg"}
                            alt={`${config?.system_name || "EasySSH"} Logo`}
                            width={64}
                            height={64}
                            className="w-16 h-16"
                          />
                        </div>
                        <h3 className="text-2xl font-bold">
                          {config?.system_name || "EasySSH"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {tAccount("aboutTagline")}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">
                            {tAccount("aboutVersionLabel")}
                          </span>
                          <span className="font-medium">
                            {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">
                            {tAccount("aboutBuildDateLabel")}
                          </span>
                          <span className="font-medium">
                            {(() => {
                              const buildDateISO = process.env.NEXT_PUBLIC_BUILD_DATE
                              if (!buildDateISO) {
                                return tAccount("aboutBuildDateUnknown")
                              }

                              try {
                                const date = new Date(buildDateISO)
                                const timezone =
                                  config?.default_timezone || effectiveTimezone || "UTC"

                                return new Intl.DateTimeFormat(effectiveLocale, {
                                  timeZone: timezone,
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                }).format(date)
                              } catch {
                                return tAccount("aboutBuildDateUnknown")
                              }
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">
                            {tAccount("aboutTechStackLabel")}
                          </span>
                          <span className="font-medium">
                            {tAccount("aboutTechStackValue")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("aboutFeaturesTitle")}
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{tAccount("aboutFeatureWebTerminal")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{tAccount("aboutFeatureFileManager")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{tAccount("aboutFeatureScriptExecution")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{tAccount("aboutFeatureMonitoring")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{tAccount("aboutFeatureAudit")}</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">
                        {tAccount("aboutOpenSourceTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {tAccount("aboutOpenSourceDescription", {
                          name: config?.system_name || "EasySSH",
                        })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          {tAccount("aboutGithubButton")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          {tAccount("aboutDocsButton")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          {tAccount("aboutFeedbackButton")}
                        </Button>
                      </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground pt-2">
                      <p>
                        {tAccount("aboutFooterCopyright", {
                          name: config?.system_name || "EasySSH",
                        })}
                      </p>
                      <p className="mt-1">
                        {tAccount("aboutFooterBuiltBy")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>

      {/* QR 码扫描对话框 */}
      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-center">
            {tAccount("security2faQrDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {tAccount("security2faQrDialogDescription")}
          </DialogDescription>
          <div className="flex flex-col items-center space-y-6 py-4">
            {/* 二维码 */}
            {qrCodeUrl && (
              <div className="p-6 bg-white rounded-xl shadow-sm">
                <QRCodeSVG value={qrCodeUrl} size={200} level="H" />
              </div>
            )}

            {/* 分割线 */}
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {tAccount("security2faQrDialogOrManual")}
                </span>
              </div>
            </div>

            {/* 手动输入密钥 */}
            <div className="w-full space-y-2">
              <Label className="text-sm font-medium">
                {tAccount("security2faQrSecretLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={totpSecret}
                  readOnly
                  className="font-mono text-sm bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(totpSecret)
                    toast.success(
                      tAccount("copyToastSuccess", {
                        label: tAccount("security2faQrSecretLabel"),
                      }),
                    )
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 验证码输入 */}
            <div className="w-full space-y-3">
              <Label className="text-sm font-medium text-center block">
                {tAccount("security2faCodeInputLabel")}
              </Label>
              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {tAccount("security2faCodeInputHint")}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setQrCodeDialogOpen(false)}>
              {tAccount("security2faQrCancel")}
            </Button>
            <Button
              onClick={handleEnable2FA}
              disabled={twoFactorLoading || verificationCode.length !== 6}
              className="min-w-[120px]"
            >
              {twoFactorLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tAccount("security2faQrConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 备份码对话框 */}
      <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-center">
            {tAccount("security2faBackupDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {tAccount("security2faBackupDialogDescription")}
          </DialogDescription>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border hover:bg-muted/80 transition-colors"
                >
                  <span className="font-mono text-sm font-medium">{code}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-background"
                    onClick={() => handleCopyCode(code)}
                  >
                    {copiedCode === code ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleCopyAllCodes}
            >
              <Copy className="mr-2 h-4 w-4" />
              {tAccount("security2faBackupCopyAllButton")}
            </Button>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
                {tAccount("security2faBackupCopyHint")}
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setBackupCodesDialogOpen(false)} className="min-w-[120px]">
              {tAccount("security2faBackupSavedButton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 禁用 2FA 确认对话框 */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {tAccount("security2faDisableDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              {tAccount("security2faDisableDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-sm font-medium text-center block">
              {tAccount("security2faCodeInputLabel")}
            </Label>
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={disableCode}
                onChange={(value) => setDisableCode(value)}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {tAccount("security2faCodeInputHint")}
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => setDisableCode("")}
              className="min-w-[100px]"
            >
              {tAccount("security2faDisableDialogCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              disabled={twoFactorLoading || disableCode.length !== 6}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[120px]"
            >
              {twoFactorLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tAccount("security2faDisableDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI配置重置确认对话框 */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tAccount("aiResetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tAccount("aiResetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {tAccount("aiResetConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAIConfig}
              disabled={aiLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {aiLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tAccount("aiResetConfirmOk")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
})
