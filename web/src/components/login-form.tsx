"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Lock, User } from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { useSystemConfig } from "@/contexts/system-config-context"
import { authApi } from "@/lib/api/auth"
import { twoFactorApi } from "@/lib/api/2fa"
import { FadeSlideIn } from "@/components/ui/fade-slide-in"
import { getErrorMessage } from "@/lib/error-utils"
import { generateCodeVerifier, deriveCodeChallenge } from "@/lib/pkce"
import { useAuthStore } from "@/stores/auth-store"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { config, refreshConfig } = useSystemConfig()
  const setToken = useAuthStore((state) => state.setToken)

  // 为避免预取到“未登录”的缓存结果，删除预取 dashboard 的逻辑

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  // 2FA 相关状态（PKCE + 2FA）
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")

  // PKCE 状态，在 2FA 流程中复用
  const [codeVerifier, setCodeVerifier] = useState("")
  const [codeChallenge, setCodeChallenge] = useState("")
  const [pkceState, setPkceState] = useState("")
  const [redirectUri, setRedirectUri] = useState("")

  // 登录成功后的回跳路径,优先使用 /login?next=xxx 中的 next
  const getRedirectTarget = useCallback(() => {
    const rawNext = searchParams.get("next")
    if (
      rawNext &&
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.startsWith("/login")
    ) {
      return rawNext
    }
    return "/dashboard"
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // 避免重复提交
    if (isLoading) return

    setIsLoading(true)

    try {
      // 1. 生成 code_verifier 和 code_challenge
      const verifier = generateCodeVerifier()
      const challenge = await deriveCodeChallenge(verifier)
      const state = generateCodeVerifier(32)

      const ru =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "/auth/callback"

      // 保存 PKCE 参数供 2FA 步骤复用
      setCodeVerifier(verifier)
      setCodeChallenge(challenge)
      setPkceState(state)
      setRedirectUri(ru)

      // 2. 调用 /oauth/authorize：根据是否启用 2FA 决定流程
      const authorizeResp = await authApi.authorizeWithPkce({
        username,
        password,
        client_id: "easyssh-web",
        redirect_uri: ru,
        scope: "openid profile easyssh",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      })

      // 启用 2FA：进入第二步
      if (authorizeResp.requires_2fa && authorizeResp.temp_token) {
        setTempToken(authorizeResp.temp_token)
        setRequires2FA(true)
        toast.info("需要双因子认证", {
          description: "请输入认证应用中的 6 位验证码",
        })
        setIsLoading(false)
        return
      }

      // 未启用 2FA：直接使用授权码换取 access_token
      if (!authorizeResp.code) {
        throw new Error("授权码为空")
      }

      const tokenResp = await authApi.exchangeCodeForToken({
        code: authorizeResp.code,
        client_id: "easyssh-web",
        redirect_uri: ru,
        code_verifier: verifier,
      })

      if (!tokenResp.access_token) {
        throw new Error("未能获取 access_token")
      }

      const expiresIn = typeof tokenResp.expires_in === "number" ? tokenResp.expires_in : 0
      setToken(tokenResp.access_token, expiresIn)
      // 标记当前设备曾成功登录，用于后续按需尝试基于 refresh_token 的静默续期
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("easyssh_has_login", "1")
        } catch {
          // ignore
        }
      }

      toast.success("登录成功", {
        description: "正在跳转到控制台...",
      })
      // 刷新全局 authStatus/system_config
      await refreshConfig()
      router.replace(getRedirectTarget())
    } catch (error: unknown) {
      console.error("Login error:", error)
      toast.error("登录失败", {
        description: getErrorMessage(error, "请检查输入信息并重试"),
      })
      setIsLoading(false)
    }
  }

  // 处理 2FA 表单提交
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    if (!twoFactorCode || twoFactorCode.length !== 6) {
      toast.error("请输入 6 位验证码")
      return
    }

    setIsLoading(true)

    try {
      const verifyResp = await twoFactorApi.verifyLogin({
        tempToken,
        code: twoFactorCode,
        clientId: "easyssh-web",
        redirectUri,
        scope: "openid profile easyssh",
        codeChallenge: codeChallenge,
        codeChallengeMethod: "S256",
        state: pkceState,
      })

      if (!verifyResp.code) {
        throw new Error("2FA 验证成功但未返回授权码")
      }

      const tokenResp = await authApi.exchangeCodeForToken({
        code: verifyResp.code,
        client_id: "easyssh-web",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      })

      if (!tokenResp.access_token) {
        throw new Error("未能获取 access_token")
      }

      const expiresIn = typeof tokenResp.expires_in === "number" ? tokenResp.expires_in : 0
      setToken(tokenResp.access_token, expiresIn)
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("easyssh_has_login", "1")
        } catch {
          // ignore
        }
      }

      toast.success("验证成功", {
        description: "正在跳转到控制台...",
      })

      await refreshConfig()
      router.replace(getRedirectTarget())
    } catch (error: unknown) {
      console.error("2FA verification error:", error)
      toast.error("验证失败", {
        description: getErrorMessage(error, "验证码错误，请重试"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 返回到账号密码登录
  const handleBack = () => {
    setRequires2FA(false)
    setTempToken("")
    setTwoFactorCode("")
    setPassword("")
  }

  // 监听 2FA 验证码输入，长度达到 6 位时自动提交
  useEffect(() => {
    if (twoFactorCode.length === 6 && requires2FA && !isLoading) {
      void (async () => {
        await handle2FASubmit(new Event("submit") as any)
      })()
    }
  }, [twoFactorCode, requires2FA, isLoading])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={requires2FA ? handle2FASubmit : handleSubmit}>
        <FieldGroup>
          {/* Logo 和标题 */}
          <FadeSlideIn delay={0}>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-16 items-center justify-center">
                  <Image
                    src={config?.system_logo || "/logo.svg"}
                    alt={`${config?.system_name || "EasySSH"} Logo`}
                    width={64}
                    height={64}
                    className="size-16 transition-opacity duration-200"
                    priority
                    style={{
                      // 防止闪烁: 设置固定尺寸避免布局偏移
                      width: '64px',
                      height: '64px',
                      // 使用 will-change 提示浏览器优化
                      willChange: 'opacity',
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {requires2FA ? "双因子认证" : `欢迎使用 ${config?.system_name || "EasySSH"}`}
                  </h1>
                  {requires2FA && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      请输入认证应用中的验证码
                    </p>
                  )}
                </div>
              </div>
            </div>
          </FadeSlideIn>

          {/* 表单卡片：去掉背景色与边框/阴影 */}
          <div className="rounded-xl p-6 bg-transparent">
            {requires2FA ? (
              // 2FA 验证表单
              <div className="space-y-4">
                <FadeSlideIn delay={0.1}>
                  <Field>
                    <FieldLabel htmlFor="2fa-code" className="text-zinc-700 dark:text-zinc-200">
                      验证码
                    </FieldLabel>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(value) => setTwoFactorCode(value)}
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
                  <FieldDescription className="text-zinc-600 dark:text-zinc-500 text-xs text-center">
                    打开认证应用（如 Google Authenticator）获取验证码
                  </FieldDescription>
                </Field>
              </FadeSlideIn>

                {/* 验证按钮 */}
                <FadeSlideIn delay={0.2}>
                  <Field>
                    <Button
                      type="submit"
                      disabled={isLoading || twoFactorCode.length !== 6}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <span className="mr-2">验证中</span>
                          <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        </>
                      ) : (
                        "验证"
                      )}
                    </Button>
                  </Field>
                </FadeSlideIn>

                {/* 返回按钮 */}
                <FadeSlideIn delay={0.3}>
                  <Field>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="w-full"
                      disabled={isLoading}
                    >
                      返回登录
                    </Button>
                  </Field>
                </FadeSlideIn>

                {/* 备份码提示 */}
                <FadeSlideIn delay={0.4}>
                  <div className="text-center text-xs text-zinc-600 dark:text-zinc-500">
                    无法访问认证应用？使用备份码登录
                  </div>
                </FadeSlideIn>
              </div>
            ) : (
              // 账号密码登录表单
              <div className="space-y-4">
              {/* 账号输入 */}
              <FadeSlideIn delay={0.1}>
                <Field>
                  <FieldLabel htmlFor="username" className="text-zinc-700 dark:text-zinc-200">
                    账号
                  </FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="请输入账号"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                      required
                    />
                  </div>
                </Field>
              </FadeSlideIn>

              {/* 密码输入 */}
              <FadeSlideIn delay={0.2}>
                <Field>
                  <FieldLabel htmlFor="password" className="text-zinc-700 dark:text-zinc-200">
                    密码
                  </FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </FadeSlideIn>

              {/* 忘记密码 */}
              <FadeSlideIn delay={0.3}>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-0 h-auto no-underline hover:no-underline transition-colors"
                    onClick={() => {
                      toast.info("忘记密码", {
                        description: "请联系管理员重置密码",
                      })
                    }}
                  >
                    忘记密码？
                  </Button>
                </div>
              </FadeSlideIn>

              {/* 登录按钮 */}
              <FadeSlideIn delay={0.4}>
                <Field>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <span className="mr-2">登录中</span>
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      </>
                    ) : (
                      "登录"
                    )}
                  </Button>
                </Field>
              </FadeSlideIn>
            </div>
            )}
          </div>

          {/* 底部提示 */}
          {!requires2FA && (
            <div className="space-y-3">

            {/* 注册提示 */}
            <FadeSlideIn delay={0.5}>
              <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                还没有账号？
                <Button
                  type="button"
                  variant="link"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-0 h-auto ml-1 no-underline hover:no-underline transition-colors"
                  onClick={() => {
                    toast.info("申请开通账号", {
                      description: "请联系管理员开通账号权限",
                    })
                  }}
                >
                  申请开通
                </Button>
              </div>
            </FadeSlideIn>

            {/* 版本信息 */}
            <FadeSlideIn delay={0.6}>
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-600">
                {config?.system_name || "EasySSH"} v1.0.0 | © 2025 All rights reserved
              </div>
            </FadeSlideIn>
          </div>
          )}
        </FieldGroup>
      </form>
    </div>
  )
}
