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
  // 自定义面包屑路径（不包含根级 "EasySSH 控制台"）
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
    showTitle: false,
  },

  // ===================
  // 连接管理
  // ===================
  '/dashboard/servers': {
    showTitle: false,
  },
  '/dashboard/servers/history': {
    breadcrumbs: [
      { title: '连接管理', href: '/dashboard/servers' },
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
      { title: '终端', href: '/dashboard/terminal' },
    ],
  },

  // ===================
  // 自动化模块
  // ===================
  '/dashboard/scripts': {
    breadcrumbs: [
      { title: '自动化' }, // 无父级聚合页，不可点击
    ],
  },
  '/dashboard/automation/schedules': {
    breadcrumbs: [
      { title: '自动化' },
    ],
  },
  '/dashboard/automation/history': {
    breadcrumbs: [
      { title: '自动化' },
    ],
  },
  '/dashboard/automation/batch': {
    breadcrumbs: [
      { title: '自动化' },
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
      { title: '文件传输', href: '/dashboard/sftp' },
    ],
  },
  '/dashboard/storage': {
    breadcrumbs: [
      { title: '文件管理' }, // 无明确的父级页面
    ],
  },

  // ===================
  // 监控告警
  // ===================
  '/dashboard/monitoring/resources': {
    breadcrumbs: [
      { title: '监控告警' }, // 统一使用侧边栏名称
    ],
  },
  '/dashboard/monitoring/alerts': {
    breadcrumbs: [
      { title: '监控告警' },
    ],
  },
  '/dashboard/monitoring/health': {
    breadcrumbs: [
      { title: '监控告警' },
    ],
  },

  // ===================
  // 日志审计
  // ===================
  '/dashboard/logs': {
    breadcrumbs: [
      { title: '日志审计' }, // 统一命名
    ],
  },
  '/dashboard/logs/login': {
    breadcrumbs: [
      { title: '日志审计', href: '/dashboard/logs' },
    ],
  },
  '/dashboard/logs/commands': {
    breadcrumbs: [
      { title: '日志审计', href: '/dashboard/logs' },
    ],
  },
  '/dashboard/logs/files': {
    breadcrumbs: [
      { title: '日志审计', href: '/dashboard/logs' },
    ],
  },

  // ===================
  // 系统配置
  // ===================
  '/dashboard/settings/general': {
    breadcrumbs: [
      { title: '系统配置' }, // 无 /dashboard/settings 父级页面
    ],
  },
  '/dashboard/settings/security': {
    breadcrumbs: [
      { title: '系统配置' },
    ],
  },
  '/dashboard/settings/ai': {
    breadcrumbs: [
      { title: '系统配置' },
    ],
  },
  '/dashboard/settings/notifications': {
    breadcrumbs: [
      { title: '系统配置' },
    ],
  },
  '/dashboard/settings/backup': {
    breadcrumbs: [
      { title: '系统配置' },
    ],
  },

  // ===================
  // 用户管理
  // ===================
  '/dashboard/users': {
    breadcrumbs: [
      { title: '系统配置' }, // 补充父级，保持层级一致性
    ],
  },

  // ===================
  // AI 助手
  // ===================
  '/dashboard/ai-assistant': {
    breadcrumbs: [
      { title: '工作台', href: '/dashboard' },
    ],
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

  // 添加根级
  items.push({
    title: `${systemName} 控制台`,
    href: pathname === '/dashboard' ? undefined : '/dashboard',
  })

  // 添加配置的面包屑层级
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
