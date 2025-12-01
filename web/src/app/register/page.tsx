import { Metadata } from "next"
import { RegisterForm } from "@/components/register-form"

export const metadata: Metadata = {
  title: "注册 - EasySSH",
  description: "创建您的 EasySSH 账号",
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </div>
  )
}
