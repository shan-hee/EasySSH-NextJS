import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"

export default function Page() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  EasySSH 控制台
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>仪表盘</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">服务器总数</h3>
            <p className="text-3xl font-bold text-primary">12</p>
            <p className="text-sm text-muted-foreground">在线: 10 | 离线: 2</p>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">活跃连接</h3>
            <p className="text-3xl font-bold text-green-600">5</p>
            <p className="text-sm text-muted-foreground">当前正在使用的连接</p>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">今日连接</h3>
            <p className="text-3xl font-bold text-blue-600">28</p>
            <p className="text-sm text-muted-foreground">比昨日增加 15%</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-6 flex-1">
          <h3 className="text-xl font-semibold mb-4">快速操作</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/servers/add">
              <button className="bg-primary text-primary-foreground p-4 rounded-lg hover:bg-primary/90 transition-colors w-full">
                <div className="text-center">
                  <div className="text-2xl mb-2">🖥️</div>
                  <div>添加服务器</div>
                </div>
              </button>
            </Link>
            <Link href="/dashboard/keys">
              <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
                <div className="text-center">
                  <div className="text-2xl mb-2">🔑</div>
                  <div>管理密钥</div>
                </div>
              </button>
            </Link>
            <Link href="/dashboard/monitoring">
              <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
                <div className="text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <div>查看监控</div>
                </div>
              </button>
            </Link>
            <Link href="/dashboard/settings/general">
              <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
                <div className="text-center">
                  <div className="text-2xl mb-2">⚙️</div>
                  <div>系统设置</div>
                </div>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
