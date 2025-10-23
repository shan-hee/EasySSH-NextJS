"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<"checking" | "welcome" | "create-admin" | "completed">("checking")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
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
      })

      // 保存令牌
      localStorage.setItem("easyssh_access_token", response.access_token)
      localStorage.setItem("easyssh_refresh_token", response.refresh_token)

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">正在检查系统状态...</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 欢迎页面
  if (step === "welcome") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <svg
                className="h-8 w-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-3xl">欢迎使用 EasySSH</CardTitle>
            <CardDescription className="mt-4 text-base">
              感谢您选择 EasySSH!在开始使用之前,我们需要创建一个管理员账户。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">初始化设置包括:</h3>
                <ul className="mt-2 space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-start">
                    <svg className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    创建超级管理员账户
                  </li>
                  <li className="flex items-start">
                    <svg className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    配置系统基础设置
                  </li>
                  <li className="flex items-start">
                    <svg className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    准备就绪,开始使用
                  </li>
                </ul>
              </div>
              <Button onClick={handleStartSetup} className="w-full" size="lg">
                开始初始化设置
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 创建管理员表单
  if (step === "create-admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>创建管理员账户</CardTitle>
            <CardDescription>请设置您的管理员账户信息</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field>
                <FieldLabel>用户名 *</FieldLabel>
                <Input
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </Field>

              <Field>
                <FieldLabel>邮箱地址 *</FieldLabel>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>密码 *</FieldLabel>
                <Input
                  type="password"
                  placeholder="至少6个字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>

              <Field>
                <FieldLabel>确认密码 *</FieldLabel>
                <Input
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("welcome")}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  返回
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "创建中..." : "创建管理员"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 完成页面
  if (step === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">初始化完成!</h2>
            <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
              管理员账户已成功创建
              <br />
              即将跳转到仪表板...
            </p>
            <div className="mt-6">
              <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full w-full animate-pulse bg-blue-500"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
