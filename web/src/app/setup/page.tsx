"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Lock, Check, Loader2, Shield, Settings, Rocket, Play, Code, Server } from "lucide-react"
import LightRays from "@/components/LightRays"

type RunMode = "demo" | "development" | "production"

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<"checking" | "welcome" | "mode-selection" | "create-admin" | "completed">("checking")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [runMode, setRunMode] = useState<RunMode>("production")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await authApi.checkAdminStatus()
        if (status.has_admin) {
          // 已有管理员,重定向到登录页
          router.replace("/login")
        } else {
          // 需要初始化,显示欢迎页面
          setStep("welcome")
        }
      } catch (error) {
        console.error("Failed to check admin status:", error)
        setError("无法连接到服务器,请检查后端服务是否运行")
      }
    }
    checkStatus()
  }, [router])

  const handleStartSetup = () => {
    setStep("mode-selection")
  }

  const handleModeSelect = (mode: RunMode) => {
    setRunMode(mode)
    setStep("create-admin")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // 表单验证
    if (!username || !email || !password) {
      setError("请填写所有必填字段")
      return
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    if (password.length < 6) {
      setError("密码长度至少为6个字符")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await authApi.initializeAdmin({
        username,
        email,
        password,
        run_mode: runMode, // 添加运行模式
      })

      // 保存令牌到 localStorage 和 cookies
      localStorage.setItem("easyssh_access_token", response.access_token)
      localStorage.setItem("easyssh_refresh_token", response.refresh_token)

      // 同步到 cookies (客户端设置)
      document.cookie = `easyssh_access_token=${response.access_token}; path=/; max-age=3600; samesite=lax`
      document.cookie = `easyssh_refresh_token=${response.refresh_token}; path=/; max-age=604800; samesite=lax`

      // 显示完成页面
      setStep("completed")

      // 3秒后跳转到仪表板
      setTimeout(() => {
        router.replace("/dashboard")
      }, 3000)
    } catch (error: unknown) {
      console.error("Failed to initialize admin:", error)
      if (error && typeof error === "object" && "detail" in error) {
        setError(`初始化失败: ${JSON.stringify(error.detail)}`)
      } else {
        setError("初始化失败,请重试")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 检查中
  if (step === "checking") {
    return (
      <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={0.3}
            rayLength={3}
            fadeDistance={2}
            saturation={1}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            pulsating={false}
            className="opacity-60"
          />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-zinc-400" />
            <p className="text-lg text-zinc-300">正在检查系统状态...</p>
            {error && (
              <div className="mt-4 rounded-lg bg-red-950/50 border border-red-800 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 欢迎页面
  if (step === "welcome") {
    return (
      <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={0.3}
            rayLength={3}
            fadeDistance={2}
            saturation={1}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            pulsating={false}
            className="opacity-60"
          />
        </div>

        <div className="relative z-10 w-full max-w-2xl">
          <div className="flex flex-col gap-6">
            {/* Logo 和标题 */}
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-16 items-center justify-center">
                <img
                  src="/logo.svg"
                  alt="EasySSH Logo"
                  className="size-16"
                  loading="eager"
                  style={{ width: '64px', height: '64px' }}
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-zinc-50">欢迎使用 EasySSH</h1>
                <p className="text-zinc-400">
                  感谢您选择 EasySSH!在开始使用之前,我们需要完成系统初始化设置。
                </p>
              </div>
            </div>

            {/* 设置步骤 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <User className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">创建管理员</h3>
                <p className="text-sm text-zinc-500">设置超级管理员账户</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <Settings className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">选择模式</h3>
                <p className="text-sm text-zinc-500">配置运行环境模式</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <Rocket className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">开始使用</h3>
                <p className="text-sm text-zinc-500">准备就绪,立即开始</p>
              </div>
            </div>

            <Button
              onClick={handleStartSetup}
              className="w-full"
              size="lg"
            >
              开始初始化设置
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 模式选择页面
  if (step === "mode-selection") {
    const modes = [
      {
        id: "demo" as RunMode,
        name: "演示模式",
        icon: Play,
        description: "用于演示和展示功能,包含示例数据",
        features: ["预置演示数据", "功能完整展示", "适合快速体验"],
      },
      {
        id: "development" as RunMode,
        name: "开发模式",
        icon: Code,
        description: "用于开发和测试,包含调试工具",
        features: ["详细日志输出", "调试工具可用", "热重载支持"],
      },
      {
        id: "production" as RunMode,
        name: "生产模式",
        icon: Server,
        description: "用于正式环境,性能和安全性优化",
        features: ["性能优化", "增强安全性", "生产级配置"],
      },
    ]

    return (
      <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={0.3}
            rayLength={3}
            fadeDistance={2}
            saturation={1}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            pulsating={false}
            className="opacity-60"
          />
        </div>

        <div className="relative z-10 w-full max-w-4xl">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50 mb-2">选择运行模式</h1>
              <p className="text-zinc-400">根据您的使用场景选择合适的运行模式</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {modes.map((mode) => {
                const Icon = mode.icon
                const isSelected = runMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => setRunMode(mode.id)}
                    className={`relative rounded-xl border p-6 text-left transition-all ${
                      isSelected
                        ? "border-zinc-600 bg-zinc-800/80"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute right-4 top-4">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700">
                          <Check className="h-4 w-4 text-zinc-200" />
                        </div>
                      </div>
                    )}
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                      <Icon className="h-6 w-6 text-zinc-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-zinc-200">{mode.name}</h3>
                    <p className="mb-4 text-sm text-zinc-500">{mode.description}</p>
                    <ul className="space-y-2">
                      {mode.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm text-zinc-400">
                          <Check className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("welcome")}
                className="flex-1"
              >
                返回
              </Button>
              <Button
                onClick={() => handleModeSelect(runMode)}
                className="flex-1"
              >
                下一步
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 创建管理员表单
  if (step === "create-admin") {
    return (
      <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={0.3}
            rayLength={3}
            fadeDistance={2}
            saturation={1}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            pulsating={false}
            className="opacity-60"
          />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-50 mb-2">创建管理员账户</h1>
              <p className="text-zinc-400">请设置您的管理员账户信息</p>
            </div>

            {/* 显示选择的模式 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">运行模式:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">
                    {runMode === "demo" ? "演示模式" : runMode === "development" ? "开发模式" : "生产模式"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep("mode-selection")}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    更改
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="username" className="text-zinc-200">
                  用户名 *
                </FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    required
                    autoFocus
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="email" className="text-zinc-200">
                  邮箱地址 *
                </FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    required
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="password" className="text-zinc-200">
                  密码 *
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="至少6个字符"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    required
                    minLength={6}
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword" className="text-zinc-200">
                  确认密码 *
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    required
                    minLength={6}
                  />
                </div>
              </Field>

              {error && (
                <div className="rounded-lg bg-red-950/50 border border-red-800 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("mode-selection")}
                disabled={isSubmitting}
                className="flex-1"
              >
                返回
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "创建管理员"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 完成页面
  if (step === "completed") {
    return (
      <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={0.3}
            rayLength={3}
            fadeDistance={2}
            saturation={1}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            pulsating={false}
            className="opacity-60"
          />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-zinc-50">初始化完成!</h2>
              <p className="text-zinc-400">
                管理员账户已成功创建
                <br />
                <span className="text-sm">即将跳转到仪表板...</span>
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-full animate-[progress_3s_ease-in-out] bg-zinc-600"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
