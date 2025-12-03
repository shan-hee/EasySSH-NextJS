"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { useSystemConfig } from "@/contexts/system-config-context"
import { authApi } from "@/lib/api/auth"
import { FadeSlideIn } from "@/components/ui/fade-slide-in"
import { getErrorMessage } from "@/lib/error-utils"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { config } = useSystemConfig()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 发送验证码
  const handleSendCode = async () => {
    // 验证邮箱格式
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("邮箱格式无效", {
        description: "请输入有效的邮箱地址",
      })
      return
    }

    setIsSendingCode(true)

    try {
      await authApi.sendPasswordResetCode({ email })
      toast.success("验证码已发送", {
        description: "请查收您的邮箱",
      })
      setCountdown(60) // 60秒倒计时
    } catch (error: unknown) {
      console.error("Send code error:", error)
      toast.error("发送验证码失败", {
        description: getErrorMessage(error, "无法发送验证码，请稍后重试"),
      })
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 避免重复提交
    if (isLoading) return

    // 验证密码匹配
    if (newPassword !== confirmPassword) {
      toast.error("密码不匹配", {
        description: "两次输入的密码不一致",
      })
      return
    }

    // 验证密码长度
    if (newPassword.length < 8) {
      toast.error("密码过短", {
        description: "密码长度至少为 8 个字符",
      })
      return
    }

    // 验证密码复杂度
    const hasUpper = /[A-Z]/.test(newPassword)
    const hasLower = /[a-z]/.test(newPassword)
    const hasDigit = /[0-9]/.test(newPassword)

    if (!hasUpper || !hasLower || !hasDigit) {
      toast.error("密码复杂度不足", {
        description: "密码必须包含大写字母、小写字母和数字",
      })
      return
    }

    // 验证验证码
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("验证码无效", {
        description: "请输入 6 位数字验证码",
      })
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // 调用重置密码 API
      await authApi.resetPassword({
        email,
        verification_code: verificationCode,
        new_password: newPassword,
      })

      toast.success("密码重置成功", {
        description: "您现在可以使用新密码登录",
      })

      // 跳转到登录页面
      setTimeout(() => {
        router.push("/login")
      }, 1000)
    } catch (error: unknown) {
      console.error("Reset password error:", error)
      toast.error("密码重置失败", {
        description: getErrorMessage(error, "无法重置密码，请稍后重试"),
      })
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
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
                      width: '64px',
                      height: '64px',
                      willChange: 'opacity',
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    重置密码
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    输入您的邮箱地址以重置密码
                  </p>
                </div>
              </div>
            </div>
          </FadeSlideIn>

          {/* 表单卡片 */}
          <div className="rounded-xl p-6 bg-transparent">
            <div className="space-y-4">
              {/* 邮箱输入 */}
              <FadeSlideIn delay={0.1}>
                <Field>
                  <FieldLabel htmlFor="email" className="text-zinc-700 dark:text-zinc-200">
                    邮箱地址
                  </FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                      required
                    />
                  </div>
                  <FieldDescription className="text-zinc-600 dark:text-zinc-500 text-xs">
                    我们将向此邮箱发送验证码
                  </FieldDescription>
                </Field>
              </FadeSlideIn>

              {/* 验证码输入 */}
              <FadeSlideIn delay={0.2}>
                <Field>
                  <FieldLabel htmlFor="verificationCode" className="text-zinc-700 dark:text-zinc-200">
                    验证码
                  </FieldLabel>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                      <Input
                        id="verificationCode"
                        type="text"
                        placeholder="输入 6 位验证码"
                        name="verificationCode"
                        autoComplete="off"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="pl-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                        required
                        maxLength={6}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={isSendingCode || countdown > 0 || !email}
                      className="whitespace-nowrap"
                    >
                      {isSendingCode ? (
                        <span>发送中...</span>
                      ) : countdown > 0 ? (
                        <span>{countdown}s</span>
                      ) : (
                        <span>发送验证码</span>
                      )}
                    </Button>
                  </div>
                  <FieldDescription className="text-zinc-600 dark:text-zinc-500 text-xs">
                    验证码有效期为 5 分钟
                  </FieldDescription>
                </Field>
              </FadeSlideIn>

              {/* 新密码输入 */}
              <FadeSlideIn delay={0.3}>
                <Field>
                  <FieldLabel htmlFor="newPassword" className="text-zinc-700 dark:text-zinc-200">
                    新密码
                  </FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="输入新密码"
                      name="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                      required
                      minLength={8}
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
                  <FieldDescription className="text-zinc-600 dark:text-zinc-500 text-xs">
                    密码长度至少为 8 个字符，必须包含大写字母、小写字母和数字
                  </FieldDescription>
                </Field>
              </FadeSlideIn>

              {/* 确认密码输入 */}
              <FadeSlideIn delay={0.4}>
                <Field>
                  <FieldLabel htmlFor="confirmPassword" className="text-zinc-700 dark:text-zinc-200">
                    确认新密码
                  </FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-500" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="再次输入新密码"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/80 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </FadeSlideIn>

              {/* 重置按钮 */}
              <FadeSlideIn delay={0.5}>
                <Field>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <span className="mr-2">重置中...</span>
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      </>
                    ) : (
                      "重置密码"
                    )}
                  </Button>
                </Field>
              </FadeSlideIn>
            </div>
          </div>

          {/* 底部提示 */}
          <div className="space-y-3">
            {/* 返回登录 */}
            <FadeSlideIn delay={0.6}>
              <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                记起密码了？
                <Button
                  type="button"
                  variant="link"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-0 h-auto ml-1 no-underline hover:no-underline transition-colors"
                  onClick={() => router.push("/login")}
                >
                  返回登录
                </Button>
              </div>
            </FadeSlideIn>

            {/* 版本信息 */}
            <FadeSlideIn delay={0.7}>
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-600">
                {config?.system_name || "EasySSH"} v1.0.0 | © 2025 All rights reserved
              </div>
            </FadeSlideIn>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}
