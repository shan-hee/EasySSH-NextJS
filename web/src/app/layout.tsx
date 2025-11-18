import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { SystemConfigProvider } from "@/contexts/system-config-context";
import { DynamicHeadUpdater } from "@/components/dynamic-head-updater";
import { QueryProvider } from "@/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "EasySSH",
    template: "%s | EasySSH",
  },
  description: "EasySSH 是一个现代化的 SSH 服务器管理平台，提供便捷的服务器连接、文件传输、操作审计等功能",
  keywords: ["SSH", "服务器管理", "远程连接", "文件传输", "审计日志", "EasySSH"],
  authors: [{ name: "EasySSH Team" }],
  creator: "EasySSH",
  publisher: "EasySSH",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "EasySSH",
    description: "现代化的 SSH 服务器管理平台，提供便捷的服务器连接、文件传输、操作审计等功能",
    siteName: "EasySSH",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasySSH",
    description: "现代化的 SSH 服务器管理平台",
  },
  robots: {
    index: false, // 内部管理系统，不需要被搜索引擎索引
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* no-FOUC: 在样式加载前同步设置主题类，避免闪烁 */}
        <script
          id="no-flash-theme"
          dangerouslySetInnerHTML={{
            __html: `!function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}}();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <SystemConfigProvider>
                <DynamicHeadUpdater />
                {children}
              </SystemConfigProvider>
            </AuthProvider>
          </QueryProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
