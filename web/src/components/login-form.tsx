"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Lock, User, Shield } from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { useAuth } from "@/contexts/auth-context"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { login, isLoading: authLoading } = useAuth()

  // 预取控制台页面，加速跳转
  useEffect(() => {
    try {
      router.prefetch?.('/dashboard')
    } catch {}
  }, [router])

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || authLoading) return

    setIsLoading(true)

    try {
      await login({ username, password })
      toast.success("登录成功", {
        description: "正在跳转到控制台...",
      })
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error("登录失败", {
        description: error?.detail?.error || error?.message || "请检查输入信息并重试",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {/* Logo 和标题 */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-16 items-center justify-center">
                <img src="/logo.svg" alt="EasySSH Logo" className="size-16" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-zinc-50">欢迎使用 EasySSH</h1>
                <p className="text-sm text-zinc-400">
                  安全高效的远程服务器管理平台
                </p>
              </div>
            </div>
          </div>

          {/* 表单卡片：去掉背景色与边框/阴影 */}
          <div className="rounded-xl p-6 bg-transparent">
            <div className="space-y-4">
              {/* 账号输入 */}
              <Field>
                <FieldLabel htmlFor="username" className="text-zinc-200">
                  账号
                </FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入账号"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-600"
                    required
                  />
                </div>
              </Field>

              {/* 密码输入 */}
              <Field>
                <FieldLabel htmlFor="password" className="text-zinc-200">
                  密码
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              {/* 记住密码和忘记密码 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors"
                  >
                    记住密码
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-zinc-400 hover:text-zinc-200 p-0 h-auto no-underline hover:no-underline transition-colors"
                  onClick={() => {
                    toast.info("忘记密码", {
                      description: "请联系管理员重置密码",
                    })
                  }}
                >
                  忘记密码？
                </Button>
              </div>

              {/* 登录按钮 */}
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
            </div>
          </div>

          {/* 底部提示 */}
          <div className="space-y-3">
            {/* 安全提示 */}
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Shield className="h-3 w-3" />
              <span>您的连接已通过 SSL 加密保护</span>
            </div>

            {/* 注册提示 */}
            <div className="text-center text-sm text-zinc-400">
              还没有账号？
              <Button
                type="button"
                variant="link"
                className="text-zinc-400 hover:text-zinc-200 p-0 h-auto ml-1 no-underline hover:no-underline transition-colors"
                onClick={() => {
                  toast.info("申请开通账号", {
                    description: "请联系管理员开通账号权限",
                  })
                }}
              >
                申请开通
              </Button>
            </div>

            {/* 版本信息 */}
            <div className="text-center text-xs text-zinc-600">
              EasySSH v1.0.0 | © 2025 All rights reserved
            </div>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}
