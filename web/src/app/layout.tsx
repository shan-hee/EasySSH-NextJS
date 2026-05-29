import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SystemConfigProvider } from "@/contexts/system-config-context";
import { DynamicHeadUpdater } from "@/components/dynamic-head-updater";
import { QueryProvider } from "@/providers/query-provider";
import { SessionRefreshProvider } from "@/providers/session-refresh-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-sc",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
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
  description:
    "EasySSH is a modern SSH server management platform for secure connections, file transfers and operation auditing.",
  keywords: ["SSH", "server management", "remote access", "file transfer", "audit logs", "EasySSH"],
  authors: [{ name: "EasySSH Team" }],
  creator: "EasySSH",
  publisher: "EasySSH",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "EasySSH",
    description:
      "EasySSH is a modern SSH server management platform for secure connections, file transfers and operation auditing.",
    siteName: "EasySSH",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasySSH",
    description: "Modern SSH server management platform",
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
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansSC.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        {/* no-FOUC: 在样式加载前同步设置主题类和语言属性，避免闪烁 */}
        <script
          id="no-flash-init"
          dangerouslySetInnerHTML={{
            __html: `!function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');var dark=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){d.classList.add('dark')}else{d.classList.remove('dark')};var l=localStorage.getItem('user-language');if(l==='zh-CN'||l==='en-US'){d.setAttribute('lang',l)};var s='';var g=localStorage.getItem('easyssh-theme-generator');if(g){try{s=JSON.parse(g).css||''}catch(e){s=''}}if(s){var el=document.getElementById('easyssh-theme-generator-style');if(!el){el=document.createElement('style');el.id='easyssh-theme-generator-style';document.head.appendChild(el)}el.textContent=s}}catch(e){}}();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <SystemConfigProvider>
              <SessionRefreshProvider>
                <DynamicHeadUpdater />
                {children}
              </SessionRefreshProvider>
            </SystemConfigProvider>
          </QueryProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
