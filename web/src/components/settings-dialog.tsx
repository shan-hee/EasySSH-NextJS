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
  QrCode,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
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
import { useAuth } from "@/contexts/auth-context"
import { useClientAuth } from "@/components/client-auth-provider"
import { authApi } from "@/lib/api/auth"
import { twoFactorApi } from "@/lib/api/2fa"
import { sessionsApi, type Session } from "@/lib/api/sessions"
import { notificationsApi } from "@/lib/api/notifications"
import * as sshKeysApi from "@/lib/api/ssh-keys"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

const data = {
  nav: [
    { name: "个人信息", icon: User },
    { name: "账户安全", icon: Lock },
    { name: "通知偏好", icon: Bell },
    { name: "SSH密钥", icon: Key },
    { name: "关于", icon: Info },
  ],
}

export const SettingsDialog = React.memo(function SettingsDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState("个人信息")

  // 使用 ClientAuthProvider 获取用户数据（dashboard 中使用）
  const { user, refreshUser, logout } = useClientAuth()

  // 个人信息表单状态
  const [profileForm, setProfileForm] = React.useState({
    username: "",
    email: "",
  })
  const [profileLoading, setProfileLoading] = React.useState(false)

  // 头像上传状态
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = React.useState<string>("")
  const [avatarUploading, setAvatarUploading] = React.useState(false)
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
    }
  }, [user])

  // 当切换到账户安全标签时加载会话数据
  React.useEffect(() => {
    if (activeSection === "账户安全" && open) {
      loadSessions()
    }
  }, [activeSection, open])

  // 当切换到SSH密钥标签时加载密钥数据
  React.useEffect(() => {
    if (activeSection === "SSH密钥" && open) {
      loadSSHKeys()
    }
  }, [activeSection, open])

  // 处理头像文件选择
  const handleAvatarSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件")
      return
    }

    // 验证文件大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB")
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
        toast.success("头像已生成")
      })
      .catch(error => {
        console.error("生成头像失败:", error)
        toast.error("生成头像失败")
      })
  }, [])

  // 压缩图片
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
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
            reject(new Error('无法获取 canvas context'))
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
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    // 当对话框打开时，重新初始化头像预览
    if (newOpen && user) {
      setAvatarPreview(user.avatar || "")
      setAvatarFile(null)
    }
  }, [user])

  const handleSectionChange = React.useCallback((section: string) => {
    setActiveSection(section)
  }, [])

  // 保存个人信息
  const handleSaveProfile = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (profileForm.email && !emailRegex.test(profileForm.email)) {
      toast.error("邮箱格式不正确")
      return
    }

    setProfileLoading(true)
    try {
      let finalAvatar = avatarPreview

      // 如果选择了新图片文件，需要压缩
      if (avatarFile) {
        finalAvatar = await compressImage(avatarFile, 128, 128)
        const sizeInKB = Math.round(finalAvatar.length / 1024)
        console.log(`压缩后图片大小: ${sizeInKB} KB`)
      }

      // 保存个人信息和头像
      await authApi.updateProfile(token, {
        email: profileForm.email,
        avatar: finalAvatar, // 包含头像数据
      })
      await refreshUser()
      setAvatarFile(null) // 清除文件选择状态
      toast.success("个人信息已保存")
    } catch (error: any) {
      // 获取后端返回的详细错误信息
      let errorMessage = "保存失败，请重试"

      if (error?.detail) {
        if (typeof error.detail === 'string') {
          errorMessage = error.detail
        } else if (error.detail.message) {
          errorMessage = error.detail.message
        } else if (error.detail.error) {
          errorMessage = error.detail.error
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
    } finally {
      setProfileLoading(false)
    }
  }, [profileForm, avatarFile, avatarPreview, refreshUser])

  // 修改密码
  const handleChangePassword = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    // 验证新密码
    if (passwordForm.new_password.length < 8) {
      toast.error("新密码至少需要8位")
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("两次输入的新密码不一致")
      return
    }

    setPasswordLoading(true)
    try {
      await authApi.changePassword(token, {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      toast.success("密码修改成功，请重新登录")

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
    } catch (error: any) {
      // 获取后端返回的详细错误信息
      let errorMessage = "修改密码失败"

      if (error?.detail) {
        if (typeof error.detail === 'string') {
          errorMessage = error.detail
        } else if (error.detail.message) {
          // 翻译常见的英文错误信息
          const msg = error.detail.message
          if (msg === 'invalid old password') {
            errorMessage = "当前密码错误，请检查后重试"
          } else if (msg.includes('password must be at least')) {
            errorMessage = "新密码长度不足，至少需要6位"
          } else {
            errorMessage = error.detail.message
          }
        } else if (error.detail.error) {
          errorMessage = error.detail.error
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }, [passwordForm, logout])

  // 生成 2FA Secret（第一步）
  const handleGenerate2FA = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setTwoFactorLoading(true)
    try {
      const response = await twoFactorApi.generateSecret(token)
      setQrCodeUrl(response.qr_code_url)
      setTotpSecret(response.secret)
      setQrCodeDialogOpen(true)
      toast.success("请使用认证应用扫描二维码")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.detail?.error || error?.message || "生成 2FA Secret 失败"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }, [])

  // 启用 2FA（第二步：验证代码）
  const handleEnable2FA = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("请输入 6 位验证码")
      return
    }

    setTwoFactorLoading(true)
    try {
      const response = await twoFactorApi.enable(token, verificationCode)
      setBackupCodes(response.backup_codes)
      setQrCodeDialogOpen(false)
      setBackupCodesDialogOpen(true)
      setVerificationCode("")
      await refreshUser()
      toast.success("双因子认证已启用")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.detail?.error || error?.message || "启用失败，请检查验证码"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }, [verificationCode, refreshUser])

  // 监听启用验证码输入，自动提交
  React.useEffect(() => {
    if (verificationCode.length === 6 && qrCodeDialogOpen && !twoFactorLoading) {
      handleEnable2FA()
    }
  }, [verificationCode, qrCodeDialogOpen, twoFactorLoading, handleEnable2FA])

  // 禁用 2FA
  const handleDisable2FA = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    if (!disableCode || disableCode.length !== 6) {
      toast.error("请输入 6 位验证码")
      return
    }

    setTwoFactorLoading(true)
    try {
      await twoFactorApi.disable(token, disableCode)
      setDisableDialogOpen(false)
      setDisableCode("")
      await refreshUser()
      toast.success("双因子认证已禁用")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.detail?.error || error?.message || "禁用失败，请检查验证码"
      toast.error(errorMessage)
    } finally {
      setTwoFactorLoading(false)
    }
  }, [disableCode, refreshUser])

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
    toast.success("已复制到剪贴板")
    setTimeout(() => setCopiedCode(null), 2000)
  }, [])

  // 复制所有备份码
  const handleCopyAllCodes = React.useCallback(() => {
    const allCodes = backupCodes.join("\n")
    navigator.clipboard.writeText(allCodes)
    toast.success("已复制所有备份码")
  }, [backupCodes])

  // 加载会话列表
  const loadSessions = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) return

    setSessionsLoading(true)
    try {
      const response = await sessionsApi.list(token)
      setSessions(response.sessions || [])
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载会话列表失败"
      toast.error(errorMessage)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // 撤销单个会话
  const handleRevokeSession = React.useCallback(async (sessionId: string) => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    try {
      await sessionsApi.revoke(token, sessionId)
      toast.success("会话已撤销")
      loadSessions() // 刷新列表
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "撤销会话失败"
      toast.error(errorMessage)
    }
  }, [loadSessions])

  // 撤销所有其他会话
  const handleRevokeAllOtherSessions = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    try {
      await sessionsApi.revokeAllOthers(token)
      toast.success("已撤销所有其他会话")
      loadSessions() // 刷新列表
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "撤销会话失败"
      toast.error(errorMessage)
    }
  }, [loadSessions])

  // 更新通知设置
  const handleUpdateNotification = React.useCallback(
    async (field: "email_login" | "email_alert" | "browser", value: boolean) => {
      const token = getAccessToken()
      if (!token) {
        toast.error("未登录，请重新登录")
        return
      }

      setNotificationLoading(true)
      try {
        await notificationsApi.update(token, { [field]: value })
        toast.success("通知设置已更新")
        // 刷新用户数据
        await refreshUser()
      } catch (error: any) {
        const errorMessage =
          typeof error?.detail === "string"
            ? error.detail
            : error?.detail?.message || error?.message || "更新通知设置失败"
        toast.error(errorMessage)
        // 恢复原值
        if (field === "email_login") setNotifyEmailLogin(!value)
        if (field === "email_alert") setNotifyEmailAlert(!value)
        if (field === "browser") setNotifyBrowser(!value)
      } finally {
        setNotificationLoading(false)
      }
    },
    [refreshUser]
  )

  // 加载SSH密钥列表
  const loadSSHKeys = React.useCallback(async () => {
    const token = getAccessToken()
    if (!token) return

    setSshKeysLoading(true)
    try {
      const keys = await sshKeysApi.getSSHKeys(token)
      setSshKeys(keys)
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载SSH密钥失败"
      toast.error(errorMessage)
    } finally {
      setSshKeysLoading(false)
    }
  }, [])

  // 生成SSH密钥
  const handleGenerateKey = React.useCallback(async () => {
    if (!generateForm.name.trim()) {
      toast.error("请输入密钥名称")
      return
    }

    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setGenerateLoading(true)
    try {
      const newKey = await sshKeysApi.generateSSHKey(token, generateForm)
      toast.success("SSH密钥生成成功！")
      setSelectedKey(newKey)
      setViewKeyDialogOpen(true)
      setGenerateDialogOpen(false)
      setGenerateForm({ name: "", algorithm: "ed25519", key_size: 2048 })
      loadSSHKeys() // 刷新列表
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "生成SSH密钥失败"
      toast.error(errorMessage)
    } finally {
      setGenerateLoading(false)
    }
  }, [generateForm, loadSSHKeys])

  // 导入SSH密钥
  const handleImportKey = React.useCallback(async () => {
    if (!importForm.name.trim()) {
      toast.error("请输入密钥名称")
      return
    }
    if (!importForm.private_key.trim()) {
      toast.error("请输入私钥内容")
      return
    }

    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setImportLoading(true)
    try {
      const newKey = await sshKeysApi.importSSHKey(token, importForm)
      toast.success("SSH密钥导入成功！")
      setSelectedKey(newKey)
      setViewKeyDialogOpen(true)
      setImportDialogOpen(false)
      setImportForm({ name: "", private_key: "" })
      loadSSHKeys() // 刷新列表
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "导入SSH密钥失败"
      toast.error(errorMessage)
    } finally {
      setImportLoading(false)
    }
  }, [importForm, loadSSHKeys])

  // 删除SSH密钥
  const handleDeleteKey = React.useCallback(async (keyId: number, keyName: string) => {
    if (!confirm(`确定要删除密钥 "${keyName}" 吗？此操作无法撤销。`)) {
      return
    }

    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    try {
      await sshKeysApi.deleteSSHKey(token, keyId)
      toast.success("SSH密钥已删除")
      loadSSHKeys() // 刷新列表
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "删除SSH密钥失败"
      toast.error(errorMessage)
    }
  }, [loadSSHKeys])

  // 复制到剪贴板
  const handleCopyToClipboard = React.useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板`)
    } catch (error) {
      toast.error("复制失败，请手动复制")
    }
  }, [])

  const navItems = React.useMemo(() => data.nav, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">
          在这里自定义您的设置。
        </DialogDescription>
        <SidebarProvider>
          <Sidebar collapsible="none" className="hidden md:flex md:w-44 lg:w-48 border-r shrink-0">
            <SidebarContent className="py-4">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === activeSection}
                          onClick={() => handleSectionChange(item.name)}
                        >
                          <button>
                            <item.icon />
                            <span>{item.name}</span>
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
              <Select value={activeSection} onValueChange={handleSectionChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择设置" />
                </SelectTrigger>
                <SelectContent>
                  {navItems.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="space-y-6 p-6">
                <h3 className="text-lg font-semibold">{activeSection}</h3>
                {activeSection === "个人信息" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">头像</h4>
                      <p className="text-sm text-muted-foreground mb-3">点击头像上传图片，或使用下方按钮</p>
                      <div className="flex items-center gap-4">
                        {/* 头像显示 - 可点击上传 */}
                        <div
                          className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border cursor-pointer group"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {avatarPreview ? (
                            <img
                              src={avatarPreview}
                              alt="头像预览"
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
                                移除
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateDiceBearAvatar}
                            >
                              <Paintbrush className="h-4 w-4 mr-1" />
                              生成头像
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            支持 JPG、PNG 格式，最大 5MB
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">基本信息</h4>
                      <p className="text-sm text-muted-foreground mb-3">修改您的个人基本信息</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">用户名</Label>
                          <Input
                            id="username"
                            placeholder="用户名暂不支持修改"
                            value={profileForm.username}
                            disabled
                          />
                          <p className="text-xs text-muted-foreground">用户名修改功能需要后端支持</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">邮箱地址</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="输入邮箱地址"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <Button
                          className="mt-4"
                          onClick={handleSaveProfile}
                          disabled={profileLoading}
                        >
                          {profileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          保存信息
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">个人偏好</h4>
                      <p className="text-sm text-muted-foreground mb-3">设置您的语言和时区偏好（功能开发中）</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="language">语言</Label>
                          <Input id="language" placeholder="简体中文" defaultValue="简体中文" disabled />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">时区</Label>
                          <Input id="timezone" placeholder="Asia/Shanghai" defaultValue="Asia/Shanghai" disabled />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "账户安全" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">修改密码</h4>
                      <p className="text-sm text-muted-foreground mb-3">定期修改密码以保护账户安全</p>
                      <form className="space-y-4" onSubmit={handleChangePassword}>
                        <div className="space-y-2">
                          <Label htmlFor="current-password">当前密码</Label>
                          <Input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="输入当前密码"
                            value={passwordForm.old_password}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, old_password: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">新密码</Label>
                          <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="输入新密码（至少8位）"
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                            required
                            minLength={8}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">确认新密码</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="再次输入新密码"
                            value={passwordForm.confirm_password}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                            required
                          />
                        </div>
                        <Button
                          type="submit"
                          className="mt-4"
                          disabled={passwordLoading}
                        >
                          {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          保存密码
                        </Button>
                      </form>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">双因子认证</h4>
                      <p className="text-sm text-muted-foreground mb-3">增强账户安全性，使用 TOTP 应用验证登录</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="2fa">双因子认证状态</Label>
                            <p className="text-sm text-muted-foreground">
                              {twoFactorEnabled ? "已启用，使用认证应用验证登录" : "未启用，建议启用以增强安全"}
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
                            推荐使用 Google Authenticator、Microsoft Authenticator 或其他 TOTP 应用
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">活动会话</h4>
                          <p className="text-sm text-muted-foreground">管理您的登录会话</p>
                        </div>
                        {sessions.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRevokeAllOtherSessions}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            撤销所有其他会话
                          </Button>
                        )}
                      </div>

                      {sessionsLoading ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="text-center p-8 text-sm text-muted-foreground">
                          暂无活跃会话
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {sessions.map((session) => {
                            const DeviceIcon = session.device_type === "mobile"
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
                                        {session.device_name || "未知设备"}
                                      </p>
                                      {session.is_current && (
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                                          当前
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-0.5 text-xs text-muted-foreground">
                                      <p className="truncate">
                                        {session.ip_address}
                                        {session.location && ` · ${session.location}`}
                                      </p>
                                      <p>
                                        最后活动: {session.last_activity}
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
                {activeSection === "通知偏好" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">通知概览</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理您的个人通知偏好和接收渠道</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">邮件通知</p>
                            <p className="text-xs text-muted-foreground">
                              {notifyEmailLogin || notifyEmailAlert ? "部分启用" : "已禁用"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">浏览器通知</p>
                            <p className="text-xs text-muted-foreground">
                              {notifyBrowser ? "已启用" : "已禁用"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">邮件通知偏好</h4>
                      <p className="text-sm text-muted-foreground mb-3">选择需要接收邮件通知的事件类型</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-login">登录通知</Label>
                            <p className="text-sm text-muted-foreground">账户登录时发送邮件提醒</p>
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
                            <Label htmlFor="email-alerts">告警通知</Label>
                            <p className="text-sm text-muted-foreground">服务器告警时发送邮件提醒</p>
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
                          💡 提示：邮件服务器由系统管理员配置，您只需选择需要接收的通知类型
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">浏览器通知</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理浏览器推送通知</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="browser-notifications">启用浏览器通知</Label>
                            <p className="text-sm text-muted-foreground">接收实时浏览器推送通知</p>
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
                      <h4 className="font-medium mb-2">其他通知渠道</h4>
                      <p className="text-sm text-muted-foreground mb-3">系统管理员可以配置更多通知渠道</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <p className="text-sm font-medium">钉钉通知</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            需要管理员配置钉钉机器人
                          </p>
                        </div>
                        <div className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <p className="text-sm font-medium">企业微信通知</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            需要管理员配置企业微信机器人
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "SSH密钥" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium">我的SSH密钥</h4>
                          <p className="text-sm text-muted-foreground">管理您的个人SSH密钥对</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGenerateDialogOpen(true)}
                          >
                            生成新密钥
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImportDialogOpen(true)}
                          >
                            导入密钥
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
                          <p className="text-sm">暂无SSH密钥</p>
                          <p className="text-xs">点击上方按钮生成或导入密钥</p>
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
                                    创建于 {new Date(key.created_at).toLocaleDateString("zh-CN")}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyToClipboard(key.public_key, "公钥")}
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
                        <DialogTitle>生成SSH密钥</DialogTitle>
                        <DialogDescription>
                          生成新的SSH密钥对用于服务器连接
                        </DialogDescription>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="gen-name">密钥名称</Label>
                            <Input
                              id="gen-name"
                              placeholder="例如：生产服务器密钥"
                              value={generateForm.name}
                              onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gen-algorithm">算法</Label>
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
                                <SelectItem value="ed25519">ED25519 (推荐)</SelectItem>
                                <SelectItem value="rsa">RSA</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              ED25519更快、更安全，适合现代服务器
                            </p>
                          </div>
                          {generateForm.algorithm === "rsa" && (
                            <div className="space-y-2">
                              <Label htmlFor="gen-keysize">密钥长度</Label>
                              <Select
                                value={generateForm.key_size.toString()}
                                onValueChange={(value) =>
                                  setGenerateForm({ ...generateForm, key_size: parseInt(value) })
                                }
                              >
                                <SelectTrigger id="gen-keysize">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2048">2048 位</SelectItem>
                                  <SelectItem value="4096">4096 位 (更安全)</SelectItem>
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
                              取消
                            </Button>
                            <Button onClick={handleGenerateKey} disabled={generateLoading}>
                              {generateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              生成
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* 导入密钥对话框 */}
                    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                      <DialogContent className="sm:max-w-md">
                        <DialogTitle>导入SSH密钥</DialogTitle>
                        <DialogDescription>
                          导入已有的SSH私钥
                        </DialogDescription>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="imp-name">密钥名称</Label>
                            <Input
                              id="imp-name"
                              placeholder="例如：我的密钥"
                              value={importForm.name}
                              onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="imp-key">私钥内容</Label>
                            <textarea
                              id="imp-key"
                              className="w-full min-h-[200px] px-3 py-2 text-sm rounded-md border border-input bg-background font-mono"
                              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                              value={importForm.private_key}
                              onChange={(e) => setImportForm({ ...importForm, private_key: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              粘贴完整的PEM格式私钥
                            </p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setImportDialogOpen(false)}
                              disabled={importLoading}
                            >
                              取消
                            </Button>
                            <Button onClick={handleImportKey} disabled={importLoading}>
                              {importLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              导入
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* 查看密钥对话框（首次生成/导入后显示） */}
                    <Dialog open={viewKeyDialogOpen} onOpenChange={setViewKeyDialogOpen}>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogTitle>SSH密钥详情</DialogTitle>
                        <DialogDescription>
                          请妥善保存私钥，此窗口关闭后将无法再次查看
                        </DialogDescription>
                        {selectedKey && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label>公钥</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(selectedKey.public_key, "公钥")}
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  复制
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
                                <Label>私钥 (请妥善保存)</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(selectedKey.private_key, "私钥")}
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  复制
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
                                ⚠️ 请立即保存私钥！关闭此窗口后，私钥将无法再次查看。
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button onClick={() => {
                                setViewKeyDialogOpen(false)
                                setSelectedKey(null)
                              }}>
                                我已保存
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                {activeSection === "关于" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-6 text-center">
                      <div className="mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-3">
                          <Image
                            src="/logo.svg"
                            alt="EasySSH Logo"
                            width={64}
                            height={64}
                            className="w-16 h-16"
                          />
                        </div>
                        <h3 className="text-2xl font-bold">EasySSH</h3>
                        <p className="text-sm text-muted-foreground mt-1">现代化 SSH 管理平台</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">版本</span>
                          <span className="font-medium">1.0.0</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground">构建日期</span>
                          <span className="font-medium">2025-01-04</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">技术栈</span>
                          <span className="font-medium">Next.js + Go</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">核心功能</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>Web 终端：浏览器内直接访问 SSH</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>文件管理：SFTP 文件传输和管理</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>脚本执行：批量运维自动化</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>监控告警：实时系统资源监控</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>安全审计：完整的操作日志记录</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">开源信息</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        EasySSH 是一个开源项目，遵循 MIT 协议
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          GitHub
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          文档
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          反馈问题
                        </Button>
                      </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground pt-2">
                      <p>© 2025 EasySSH. All rights reserved.</p>
                      <p className="mt-1">Built with ❤️ by Claude & Developer</p>
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
          <DialogTitle className="text-center">扫描二维码</DialogTitle>
          <DialogDescription className="text-center">
            使用您的认证应用（如 Google Authenticator）扫描此二维码
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
                <span className="bg-background px-2 text-muted-foreground">或手动输入</span>
              </div>
            </div>

            {/* 手动输入密钥 */}
            <div className="w-full space-y-2">
              <Label className="text-sm font-medium">密钥</Label>
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
                    toast.success("已复制密钥")
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 验证码输入 */}
            <div className="w-full space-y-3">
              <Label className="text-sm font-medium text-center block">输入验证码</Label>
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
                请输入认证应用中显示的 6 位数字
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setQrCodeDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleEnable2FA}
              disabled={twoFactorLoading || verificationCode.length !== 6}
              className="min-w-[120px]"
            >
              {twoFactorLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              验证并启用
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 备份码对话框 */}
      <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-center">保存备份码</DialogTitle>
          <DialogDescription className="text-center">
            这些备份码可以在您无法使用认证应用时用于登录。每个备份码只能使用一次，请妥善保管。
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
              复制所有备份码
            </Button>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
                ⚠️ 建议将这些备份码保存到密码管理器或打印后妥善保管
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setBackupCodesDialogOpen(false)} className="min-w-[120px]">
              我已保存
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
              确认禁用双因子认证
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              禁用双因子认证将<strong className="text-foreground">降低账户的安全性</strong>。请输入认证应用中的验证码以确认此操作。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-sm font-medium text-center block">
              输入验证码
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
              请输入认证应用中显示的 6 位数字
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => setDisableCode("")}
              className="min-w-[100px]"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              disabled={twoFactorLoading || disableCode.length !== 6}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[120px]"
            >
              {twoFactorLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认禁用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
})
