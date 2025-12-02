import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SystemConfigProvider } from "@/contexts/system-config-context";
import { DynamicHeadUpdater } from "@/components/dynamic-head-updater";
import { QueryProvider } from "@/providers/query-provider";
import { SessionRefreshProvider } from "@/providers/session-refresh-provider";

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
