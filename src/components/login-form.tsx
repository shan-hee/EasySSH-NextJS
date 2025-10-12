"use client"

import { useState } from "react"
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

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // 模拟登录过程
    setTimeout(() => {
      setIsLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-12 items-center justify-center rounded-md">
                <img src="/logo.svg" alt="EasySSH Logo" className="size-10" />
              </div>
              <span className="sr-only">EasySSH</span>
            </a>
            <h1 className="text-xl font-bold">EasySSH 登录</h1>
            <FieldDescription>
              欢迎使用 EasySSH 远程连接管理工具
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="username">账号</FieldLabel>
            <Input
              id="username"
              type="text"
              placeholder="请输入账号"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              required
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
