"use client"

import { useEffect, useState } from "react"

type LoaderState = "entering" | "loading" | "exiting"

interface ConnectionLoaderProps {
  serverName?: string
  message?: string
  state?: LoaderState
  onAnimationComplete?: () => void
}

export function ConnectionLoader({
  serverName = "服务器",
  message = "正在连接",
  state = "loading",
  onAnimationComplete
}: ConnectionLoaderProps) {
  const [animationState, setAnimationState] = useState<LoaderState>(state)

  useEffect(() => {
    setAnimationState(state)
  }, [state])

  useEffect(() => {
    if (animationState === "entering") {
      // 进入动画持续 500ms
      const timer = setTimeout(() => {
        setAnimationState("loading")
      }, 500)
      return () => clearTimeout(timer)
    } else if (animationState === "exiting") {
      // 退出动画持续 500ms
      const timer = setTimeout(() => {
        onAnimationComplete?.()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [animationState, onAnimationComplete])

  // 根据状态计算飞船的样式（只有飞船移动）
  const getSpaceshipStyle = (): React.CSSProperties => {
    switch (animationState) {
      case "entering":
        return {
          animation: "slide-in-from-left 0.5s linear forwards"
        }
      case "loading":
        return {}
      case "exiting":
        return {
          animation: "slide-out-to-right 0.5s linear forwards"
        }
      default:
        return {}
    }
  }

  return (
    <div className={`h-full w-full overflow-hidden relative transition-colors bg-background [--loader-color:oklch(0.145_0_0)] dark:[--loader-color:oklch(1_0_0)]`}>
      {/* 动画背景线条 */}
      <div className="longfazers absolute inset-0">
        <span className="longfazer-1" />
        <span className="longfazer-2" />
        <span className="longfazer-3" />
        <span className="longfazer-4" />
      </div>

      {/* 飞船动画 - 绝对定位，独立移动 */}
      <div
        className="spaceship-wrapper"
        style={getSpaceshipStyle()}
      >
        <div className="spaceship-container">
          <div className="body">
            <span className="body-main">
              <span />
              <span />
              <span />
              <span />
            </span>
            <div className="base">
              <span />
              <div className="face" />
            </div>
          </div>
        </div>
      </div>

      {/* 文字信息 - 绝对定位，固定在中间 */}
      <div className="text-wrapper">
        <h1 className={"text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white"}>
          {animationState === "exiting" ? "连接成功" : message}
        </h1>
        <p className={"text-xs font-mono text-zinc-600 dark:text-zinc-500"}>
          {serverName}
        </p>
      </div>

      <style jsx>{`
        .spaceship-wrapper {
          position: absolute;
          top: calc(50% - 60px);
          left: 50%;
          margin-left: -60px;
          width: 120px;
          height: 40px;
          z-index: 10;
        }

        .spaceship-container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .text-wrapper {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, 20px);
          text-align: center;
          z-index: 10;
        }

        .text-wrapper h1 {
          margin-bottom: 8px;
        }

        /* 进入和退出动画 - 飞船水平移动，无淡入淡出 */
        @keyframes slide-in-from-left {
          from {
            transform: translateX(calc(-50vw ));
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slide-out-to-right {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(50vw));
          }
        }

        .body {
          position: absolute;
          left: 50%;
          top: 50%;
          margin-left: -50px;
          margin-top: -20px;
          animation: speeder 0.4s linear infinite;
        }

        .body .body-main {
          height: 5px;
          width: 35px;
          background: var(--loader-color);
          position: absolute;
          top: -19px;
          left: 60px;
          border-radius: 2px 10px 1px 0;
        }

        .base {
          position: relative;
        }

        .base span {
          position: absolute;
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-right: 100px solid var(--loader-color);
          border-bottom: 6px solid transparent;
        }

        .base span:before {
          content: "";
          height: 22px;
          width: 22px;
          border-radius: 50%;
          background: var(--loader-color);
          position: absolute;
          right: -110px;
          top: -16px;
        }

        .base span:after {
          content: "";
          position: absolute;
          width: 0;
          height: 0;
          border-top: 0 solid transparent;
          border-right: 55px solid var(--loader-color);
          border-bottom: 16px solid transparent;
          top: -16px;
          right: -98px;
        }

        .face {
          position: absolute;
          height: 12px;
          width: 20px;
          background: var(--loader-color);
          border-radius: 20px 20px 0 0;
          transform: rotate(-40deg);
          right: -125px;
          top: -15px;
        }

        .face:after {
          content: "";
          height: 12px;
          width: 12px;
          background: var(--loader-color);
          right: 4px;
          top: 7px;
          position: absolute;
          transform: rotate(40deg);
          transform-origin: 50% 50%;
          border-radius: 0 0 0 2px;
        }

        .body .body-main > span {
          width: 30px;
          height: 1px;
          background: var(--loader-color);
          position: absolute;
        }

        .body .body-main > span:nth-child(1) {
          animation: fazer1 0.2s linear infinite;
        }

        .body .body-main > span:nth-child(2) {
          top: 3px;
          animation: fazer2 0.4s linear infinite;
        }

        .body .body-main > span:nth-child(3) {
          top: 1px;
          animation: fazer3 0.4s linear infinite;
          animation-delay: -1s;
        }

        .body .body-main > span:nth-child(4) {
          top: 4px;
          animation: fazer4 1s linear infinite;
          animation-delay: -1s;
        }

        @keyframes fazer1 {
          0% {
            left: 0;
            opacity: 1;
          }
          100% {
            left: -80px;
            opacity: 0;
          }
        }

        @keyframes fazer2 {
          0% {
            left: 0;
            opacity: 1;
          }
          100% {
            left: -100px;
            opacity: 0;
          }
        }

        @keyframes fazer3 {
          0% {
            left: 0;
            opacity: 1;
          }
          100% {
            left: -50px;
            opacity: 0;
          }
        }

        @keyframes fazer4 {
          0% {
            left: 0;
            opacity: 1;
          }
          100% {
            left: -150px;
            opacity: 0;
          }
        }

        @keyframes speeder {
          0% {
            transform: translate(2px, 1px) rotate(0deg);
          }
          10% {
            transform: translate(-1px, -3px) rotate(-1deg);
          }
          20% {
            transform: translate(-2px, 0px) rotate(1deg);
          }
          30% {
            transform: translate(1px, 2px) rotate(0deg);
          }
          40% {
            transform: translate(1px, -1px) rotate(1deg);
          }
          50% {
            transform: translate(-1px, 3px) rotate(-1deg);
          }
          60% {
            transform: translate(-1px, 1px) rotate(0deg);
          }
          70% {
            transform: translate(3px, 1px) rotate(-1deg);
          }
          80% {
            transform: translate(-2px, -1px) rotate(1deg);
          }
          90% {
            transform: translate(2px, 1px) rotate(0deg);
          }
          100% {
            transform: translate(1px, -2px) rotate(-1deg);
          }
        }

        .longfazers {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .longfazers span {
          position: absolute;
          height: 2px;
          width: 20%;
          background: var(--loader-color);
          box-shadow: 0 0 10px color-mix(in oklch, var(--loader-color) 50%, transparent);
        }

        .longfazer-1 {
          top: 20%;
          animation: lf 0.6s linear infinite;
          animation-delay: -5s;
        }

        .longfazer-2 {
          top: 40%;
          animation: lf2 0.8s linear infinite;
          animation-delay: -1s;
        }

        .longfazer-3 {
          top: 60%;
          animation: lf3 0.6s linear infinite;
        }

        .longfazer-4 {
          top: 80%;
          animation: lf4 0.5s linear infinite;
          animation-delay: -3s;
        }

        @keyframes lf {
          0% {
            left: 200%;
          }
          100% {
            left: -200%;
            opacity: 0;
          }
        }

        @keyframes lf2 {
          0% {
            left: 200%;
          }
          100% {
            left: -200%;
            opacity: 0;
          }
        }

        @keyframes lf3 {
          0% {
            left: 200%;
          }
          100% {
            left: -100%;
            opacity: 0;
          }
        }

        @keyframes lf4 {
          0% {
            left: 200%;
          }
          100% {
            left: -100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
