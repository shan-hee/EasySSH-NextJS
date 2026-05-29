"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { authApi } from "@/lib/api/auth"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getAuthRedirectDecision, getCurrentBrowserPath } from "@/lib/auth-redirect"
import { useAuthStore } from "@/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { User, Mail, Lock, Check, Loader2, Settings, Rocket, Play, Code, Server } from "lucide-react"
import LightRays from "@/components/LightRays"
import { AuthI18nProvider } from "@/providers/auth-i18n-provider"

type RunMode = "demo" | "development" | "production"

function SetupPageInner() {
  const tSetup = useTranslations("setup")
  const router = useRouter()
  const { authStatus, isLoading, refreshConfig } = useSystemConfig()
  const setToken = useAuthStore((state) => state.setToken)
  const [step, setStep] = useState<"checking" | "welcome" | "mode-selection" | "create-admin" | "completed">("checking")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [runMode, setRunMode] = useState<RunMode>("production")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // 仅在初始检查阶段处理重定向逻辑，后续步骤不再重复跳转
    if (step !== "checking") return

    // 等待全局认证状态加载完成
    if (isLoading) return

    if (!authStatus) {
      console.error("Auth status is unavailable during setup check")
      setError(tSetup("checkingError"))
      return
    }

    const decision = getAuthRedirectDecision("setup", authStatus, {
      currentPath: getCurrentBrowserPath("/setup"),
    })
    if (decision.type === "redirect") {
      router.replace(decision.href)
      return
    }

    // 需要初始化，显示欢迎页面
    setStep("welcome")
  }, [authStatus, isLoading, router, step, tSetup])

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
      setError(tSetup("validateRequired"))
      return
    }

    if (password !== confirmPassword) {
      setError(tSetup("validatePasswordMismatch"))
      return
    }

    if (password.length < 6) {
      setError(tSetup("validatePasswordTooShort"))
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

      if (response.access_token) {
        const expiresIn = typeof response.expires_in === "number" ? response.expires_in : 0
        setToken(response.access_token, expiresIn)
      }

      // 刷新全局系统配置与认证状态，确保 need_init=false 且后续跳转不会再回到 /setup
      await refreshConfig({ refreshAuth: true })

      // 显示完成页面
      setStep("completed")

      // 3秒后跳转到仪表板
      setTimeout(() => {
        router.replace("/dashboard")
      }, 3000)
    } catch (error: unknown) {
      console.error("Failed to initialize admin:", error)
      if (error && typeof error === "object" && "detail" in error) {
        const detail =
          "detail" in error
            ? error.detail
            : undefined
        setError(
          tSetup("initFailedWithDetail", {
            detail: JSON.stringify(detail),
          }),
        )
      } else {
        setError(tSetup("initFailedGeneric"))
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
            <p className="text-lg text-zinc-300">{tSetup("checkingTitle")}</p>
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
                <Image
                  src="/logo.svg"
                  alt="EasySSH Logo"
                  width={64}
                  height={64}
                  className="size-16"
                  priority
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-zinc-50">
                  {tSetup("welcomeTitle")}
                </h1>
                <p className="text-zinc-400">{tSetup("welcomeDescription")}</p>
              </div>
            </div>

            {/* 设置步骤 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <User className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">
                  {tSetup("welcomeStepCreateAdminTitle")}
                </h3>
                <p className="text-sm text-zinc-500">
                  {tSetup("welcomeStepCreateAdminDesc")}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <Settings className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">
                  {tSetup("welcomeStepSelectModeTitle")}
                </h3>
                <p className="text-sm text-zinc-500">
                  {tSetup("welcomeStepSelectModeDesc")}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                  <Rocket className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-200 mb-2">
                  {tSetup("welcomeStepStartTitle")}
                </h3>
                <p className="text-sm text-zinc-500">
                  {tSetup("welcomeStepStartDesc")}
                </p>
              </div>
            </div>

            <Button
              onClick={handleStartSetup}
              className="w-full"
              size="lg"
            >
              {tSetup("welcomeStartButton")}
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
        name: tSetup("modeDemoName"),
        icon: Play,
        description: tSetup("modeDemoDesc"),
        features: [
          tSetup("modeDemoFeature1"),
          tSetup("modeDemoFeature2"),
          tSetup("modeDemoFeature3"),
        ],
      },
      {
        id: "development" as RunMode,
        name: tSetup("modeDevName"),
        icon: Code,
        description: tSetup("modeDevDesc"),
        features: [
          tSetup("modeDevFeature1"),
          tSetup("modeDevFeature2"),
          tSetup("modeDevFeature3"),
        ],
      },
      {
        id: "production" as RunMode,
        name: tSetup("modeProdName"),
        icon: Server,
        description: tSetup("modeProdDesc"),
        features: [
          tSetup("modeProdFeature1"),
          tSetup("modeProdFeature2"),
          tSetup("modeProdFeature3"),
        ],
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
              <h1 className="text-2xl font-bold text-zinc-50 mb-2">
                {tSetup("modeTitle")}
              </h1>
              <p className="text-zinc-400">{tSetup("modeSubtitle")}</p>
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
                {tSetup("modeBackButton")}
              </Button>
              <Button
                onClick={() => handleModeSelect(runMode)}
                className="flex-1"
              >
                {tSetup("modeNextButton")}
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
              <h1 className="text-2xl font-bold text-zinc-50 mb-2">
                {tSetup("createAdminTitle")}
              </h1>
              <p className="text-zinc-400">
                {tSetup("createAdminSubtitle")}
              </p>
            </div>

            {/* 显示选择的模式 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  {tSetup("createAdminRunModeLabel")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">
                    {runMode === "demo"
                      ? tSetup("modeDemoName")
                      : runMode === "development"
                      ? tSetup("modeDevName")
                      : tSetup("modeProdName")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep("mode-selection")}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {tSetup("createAdminChangeMode")}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="username" className="text-zinc-200">
                  {tSetup("createAdminUsernameLabel")}
                </FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={tSetup("createAdminUsernamePlaceholder")}
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
                  {tSetup("createAdminEmailLabel")}
                </FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={tSetup("createAdminEmailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    required
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="password" className="text-zinc-200">
                  {tSetup("createAdminPasswordLabel")}
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={tSetup("createAdminPasswordPlaceholder")}
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
                  {tSetup("createAdminConfirmPasswordLabel")}
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={tSetup("createAdminConfirmPasswordPlaceholder")}
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
                {tSetup("createAdminBackButton")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tSetup("createAdminSubmitting")}
                  </>
                ) : (
                  tSetup("createAdminSubmit")
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
              <h2 className="text-3xl font-bold text-zinc-50">
                {tSetup("completedTitle")}
              </h2>
              <p className="text-zinc-400">
                {tSetup("completedDescriptionLine1")}
                <br />
                <span className="text-sm">
                  {tSetup("completedDescriptionLine2")}
                </span>
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

export default function SetupPage() {
  return (
    <AuthI18nProvider>
      <SetupPageInner />
    </AuthI18nProvider>
  )
}
