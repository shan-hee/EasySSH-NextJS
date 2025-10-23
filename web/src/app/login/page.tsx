import { LoginForm } from "@/components/login-form"
import LightRays from "@/components/LightRays"

export default function LoginPage() {
  return (
    <div className="relative bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
      {/* 光线背景 */}
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

      {/* 登录表单 */}
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
