/**
 * 面包屑路由配置
 *
 * 集中管理所有页面的面包屑导航结构
 *
 * 设计原则：
 * 1. 使用侧边栏对应的分组名称，保持命名一致性
 * 2. 移除所有无效链接（href: "#"），改为 undefined
 * 3. 仅当父级页面实际存在且可访问时才添加链接
 * 4. showTitle: false 表示不显示页面标题作为面包屑项
 */

export interface BreadcrumbItem {
  title: string
  href?: string // undefined 表示不可点击（当前页或无对应页面）
}

export interface BreadcrumbConfig {
  // 不显示标题作为面包屑项（用于首页和列表页）
  showTitle?: boolean
  // 自定义面包屑路径（不包含根级系统名称）
  breadcrumbs?: BreadcrumbItem[]
}

/**
 * 路由到面包屑的映射配置
 */
export const breadcrumbRouteConfig: Record<string, BreadcrumbConfig> = {
  // ===================
  // 工作台
  // ===================
  '/dashboard': {
    // 仪表盘：显示系统名称 + 当前页面标题（Dashboard/仪表盘）
    showTitle: true,
  },

  // ===================
  // 连接管理
  // ===================
  '/dashboard/servers': {
    // 连接配置首页：仅显示系统名称 + 当前页面标题
    showTitle: true,
  },
  '/dashboard/servers/history': {
    breadcrumbs: [
      { title: 'nav.connections', href: '/dashboard/servers' },
    ],
  },

  // ===================
  // 终端
  // ===================
  '/dashboard/terminal': {
    // 终端主页无 PageHeader，此配置保留用于未来可能的改动
    showTitle: false,
  },
  '/dashboard/terminal/sessions': {
    breadcrumbs: [
      { title: 'nav.terminal', href: '/dashboard/terminal' },
    ],
  },

  // ===================
  // 自动化模块
  // ===================
  '/dashboard/scripts': {
    breadcrumbs: [
      { title: 'nav.automation' }, // 无父级聚合页，不可点击
    ],
  },
  '/dashboard/automation/schedules': {
    breadcrumbs: [
      { title: 'nav.automation' },
    ],
  },
  '/dashboard/automation/history': {
    breadcrumbs: [
      { title: 'nav.automation' },
    ],
  },
  '/dashboard/automation/batch': {
    breadcrumbs: [
      { title: 'nav.automation' },
    ],
  },

  // ===================
  // 文件管理
  // ===================
  '/dashboard/sftp': {
    showTitle: false,
  },
  '/dashboard/transfers/history': {
    breadcrumbs: [
      { title: 'nav.file', href: '/dashboard/sftp' },
    ],
  },
  '/dashboard/storage': {
    breadcrumbs: [
      { title: 'nav.file' }, // 无明确的父级页面
    ],
  },

  // ===================
  // 监控告警
  // ===================
  '/dashboard/monitoring/resources': {
    breadcrumbs: [
      { title: 'nav.monitoring' }, // 统一使用侧边栏名称
    ],
  },
  '/dashboard/monitoring/alerts': {
    breadcrumbs: [
      { title: 'nav.monitoring' },
    ],
  },
  '/dashboard/monitoring/health': {
    breadcrumbs: [
      { title: 'nav.monitoring' },
    ],
  },

  // ===================
  // 日志审计
  // ===================
  '/dashboard/logs': {
    breadcrumbs: [
      { title: 'nav.logs' }, // 统一命名
    ],
  },
  '/dashboard/logs/login': {
    breadcrumbs: [
      { title: 'nav.logs', href: '/dashboard/logs' },
    ],
  },
  '/dashboard/logs/commands': {
    breadcrumbs: [
      { title: 'nav.logs', href: '/dashboard/logs' },
    ],
  },
  '/dashboard/logs/files': {
    breadcrumbs: [
      { title: 'nav.logs', href: '/dashboard/logs' },
    ],
  },

  // ===================
  // 系统与组织
  // ===================
  '/dashboard/settings/system-config': {
    breadcrumbs: [
      { title: 'nav.systemOrg' },
    ],
  },
  '/dashboard/settings/security-center': {
    breadcrumbs: [
      { title: 'nav.systemOrg' },
    ],
  },
  '/dashboard/settings/integrations': {
    breadcrumbs: [
      { title: 'nav.systemOrg' },
    ],
  },
  '/dashboard/settings/management': {
    breadcrumbs: [
      { title: 'nav.systemOrg' },
    ],
  },

  // ===================
  // 用户管理
  // ===================
  '/dashboard/users': {
    breadcrumbs: [
      { title: 'nav.systemOrg' },
    ],
  },

  // ===================
  // AI 助手
  // ===================
  '/dashboard/ai-assistant': {
    // 显示系统名称 + AI 助手页面标题
    showTitle: true,
  },
}

/**
 * 根据路由路径获取面包屑配置
 */
export function getBreadcrumbConfig(pathname: string): BreadcrumbConfig {
  return breadcrumbRouteConfig[pathname] || {}
}

/**
 * 生成完整的面包屑路径(包含根级)
 * @param pathname - 当前路径
 * @param pageTitle - 页面标题
 * @param systemName - 系统名称(默认为 "EasySSH")
 */
export function generateBreadcrumbs(
  pathname: string,
  pageTitle: string,
  systemName: string = "EasySSH"
): BreadcrumbItem[] {
  const config = getBreadcrumbConfig(pathname)
  const items: BreadcrumbItem[] = []

  // 添加根级（“系统名称 + nav.workbench” 由页面上的 i18n 控制，这里仅保留系统名称）
  items.push({
    title: systemName,
    href: pathname === '/dashboard' ? undefined : '/dashboard',
  })

  // 添加配置的面包屑层级（这些标题由侧边栏的 i18n 负责，避免在此重复硬编码）
  if (config.breadcrumbs) {
    items.push(...config.breadcrumbs)
  }

  // 添加当前页面标题（如果 showTitle 不为 false）
  if (config.showTitle !== false) {
    items.push({
      title: pageTitle,
      href: undefined, // 当前页不可点击
    })
  }

  return items
}
