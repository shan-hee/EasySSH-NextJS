import { Metadata } from "next"
import { RegisterForm } from "@/components/register-form"
import { AuthI18nProvider } from "@/providers/auth-i18n-provider"

export const metadata: Metadata = {
  title: "Register - EasySSH",
  description: "Create your EasySSH account",
}

export default function RegisterPage() {
  return (
    <AuthI18nProvider>
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <div className="w-full max-w-md">
          <RegisterForm />
        </div>
      </div>
    </AuthI18nProvider>
  )
}
