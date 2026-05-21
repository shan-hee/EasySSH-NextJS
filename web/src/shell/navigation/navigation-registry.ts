import {
  FileText,
  FolderOpen,
  Monitor,
  Bot,
  Server,
  Settings2,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime"
import { hasAllCapabilities } from "@/shell/runtime"

export type NavTranslationKey =
  | "console"
  | "localWorkspace"
  | "servers"
  | "connections"
  | "connectionConfigs"
  | "connectionHistory"
  | "terminal"
  | "automation"
  | "scripts"
  | "schedules"
  | "executions"
  | "file"
  | "fileManager"
  | "transferHistory"
  | "trash"
  | "logs"
  | "logsOperations"
  | "logsLogin"
  | "userManagement"
  | "aiAssistant"
  | "systemSettings"
  | "settingsPlain"

export type NavigationGroupId =
  | "workbench"
  | "core"
  | "observeAudit"
  | "settings"

export type NavigationRegistryItem = {
  id: string
  titleKey: NavTranslationKey
  titleKeyByProfile?: Partial<Record<RuntimeProfile, NavTranslationKey>>
  url: string
  icon?: LucideIcon
  isActive?: boolean
  adminOnly?: boolean
  group: NavigationGroupId
  requiredCapabilities?: AppCapability[]
  profiles?: RuntimeProfile[]
  items?: {
    id: string
    titleKey: NavTranslationKey
    url: string
    requiredCapabilities?: AppCapability[]
    profiles?: RuntimeProfile[]
  }[]
}

export type SidebarNavItem = {
  id: string
  title: string
  url: string
  group: NavigationGroupId
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    id: string
    title: string
    url: string
  }[]
}

export const navigationRegistry: NavigationRegistryItem[] = [
  {
    id: "console",
    titleKey: "console",
    url: "/dashboard",
    icon: Monitor,
    isActive: true,
    group: "workbench",
    profiles: ["web"],
  },
  {
    id: "desktop-workbench",
    titleKey: "localWorkspace",
    url: "/dashboard/desktop",
    icon: Monitor,
    isActive: true,
    group: "workbench",
    profiles: ["desktop"],
    requiredCapabilities: ["servers"],
  },
  {
    id: "desktop-servers",
    titleKey: "servers",
    url: "/dashboard/servers",
    icon: Server,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["servers"],
  },
  {
    id: "desktop-terminal",
    titleKey: "terminal",
    url: "/dashboard/terminal",
    icon: Terminal,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["terminal"],
  },
  {
    id: "desktop-file-manager",
    titleKey: "fileManager",
    url: "/dashboard/sftp",
    icon: FolderOpen,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["sftp"],
  },
  {
    id: "desktop-scripts",
    titleKey: "scripts",
    url: "/dashboard/scripts",
    icon: Terminal,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["scripts"],
  },
  {
    id: "connections",
    titleKey: "connections",
    url: "#",
    icon: Server,
    group: "core",
    requiredCapabilities: ["servers"],
    profiles: ["web"],
    items: [
      {
        id: "connection-configs",
        titleKey: "connectionConfigs",
        url: "/dashboard/servers",
        requiredCapabilities: ["servers"],
      },
      {
        id: "connection-history",
        titleKey: "connectionHistory",
        url: "/dashboard/servers/history",
        requiredCapabilities: ["servers"],
      },
    ],
  },
  {
    id: "automation",
    titleKey: "automation",
    url: "#",
    icon: Terminal,
    group: "core",
    requiredCapabilities: ["scripts"],
    profiles: ["web"],
    items: [
      {
        id: "scripts",
        titleKey: "scripts",
        url: "/dashboard/scripts",
        requiredCapabilities: ["scripts"],
      },
      {
        id: "schedules",
        titleKey: "schedules",
        url: "/dashboard/automation/schedules",
        requiredCapabilities: ["automation"],
      },
      {
        id: "executions",
        titleKey: "executions",
        url: "/dashboard/automation/history",
        requiredCapabilities: ["automation"],
      },
    ],
  },
  {
    id: "file",
    titleKey: "file",
    url: "#",
    icon: FolderOpen,
    group: "core",
    requiredCapabilities: ["sftp"],
    profiles: ["web"],
    items: [
      {
        id: "file-manager",
        titleKey: "fileManager",
        url: "/dashboard/sftp",
        requiredCapabilities: ["sftp"],
      },
      {
        id: "transfer-history",
        titleKey: "transferHistory",
        url: "/dashboard/transfers/history",
        requiredCapabilities: ["transfers"],
      },
      {
        id: "trash",
        titleKey: "trash",
        url: "/dashboard/storage",
        requiredCapabilities: ["sftp"],
      },
    ],
  },
  {
    id: "transfer-history",
    titleKey: "transferHistory",
    url: "/dashboard/transfers/history",
    icon: FolderOpen,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["transfers"],
  },
  {
    id: "ai-assistant",
    titleKey: "aiAssistant",
    url: "/dashboard/ai-assistant",
    icon: Bot,
    group: "core",
    profiles: ["desktop"],
    requiredCapabilities: ["ai"],
  },
  {
    id: "logs",
    titleKey: "logs",
    url: "#",
    icon: FileText,
    group: "observeAudit",
    requiredCapabilities: ["audit"],
    profiles: ["web"],
    items: [
      {
        id: "logs-operations",
        titleKey: "logsOperations",
        url: "/dashboard/logs",
        requiredCapabilities: ["audit"],
      },
      {
        id: "logs-login",
        titleKey: "logsLogin",
        url: "/dashboard/logs/login",
        requiredCapabilities: ["login_logs"],
      },
    ],
  },
  {
    id: "user-management",
    titleKey: "userManagement",
    url: "/dashboard/users",
    icon: Users,
    isActive: false,
    adminOnly: true,
    group: "settings",
    requiredCapabilities: ["users"],
  },
  {
    id: "system-settings",
    titleKey: "systemSettings",
    titleKeyByProfile: {
      desktop: "settingsPlain",
    },
    url: "/dashboard/settings",
    icon: Settings2,
    isActive: false,
    adminOnly: true,
    group: "settings",
    requiredCapabilities: ["settings"],
  },
]

export function buildNavigationItems(params: {
  runtime?: RuntimeInfo | null
  isAdmin: boolean
  t: (key: NavTranslationKey) => string
}): SidebarNavItem[] {
  const { runtime, isAdmin, t } = params

  return navigationRegistry
    .filter((item) => isNavigationItemVisible(item, runtime, isAdmin))
    .map((item) => {
      const subItems = item.items
        ?.filter((subItem) => isNavigationItemVisible(subItem, runtime, isAdmin))
        .map((subItem) => ({
          id: subItem.id,
          title: t(subItem.titleKey),
          url: subItem.url,
        }))

      return {
        id: item.id,
        title: t(resolveNavTitleKey(item, runtime)),
        url: item.url,
        group: item.group,
        icon: item.icon,
        isActive: item.isActive,
        items: subItems,
      }
    })
    .filter((item) => item.url !== "#" || (item.items?.length ?? 0) > 0)
}

function isNavigationItemVisible(
  item: {
    adminOnly?: boolean
    profiles?: RuntimeProfile[]
    requiredCapabilities?: AppCapability[]
  },
  runtime: RuntimeInfo | null | undefined,
  isAdmin: boolean,
): boolean {
  if (item.adminOnly && !isAdmin) {
    return false
  }
  if (runtime && item.profiles && !item.profiles.includes(runtime.profile)) {
    return false
  }
  if (runtime && !hasAllCapabilities(runtime, item.requiredCapabilities)) {
    return false
  }
  return true
}

function resolveNavTitleKey(
  item: NavigationRegistryItem,
  runtime: RuntimeInfo | null | undefined,
): NavTranslationKey {
  const profileTitleKey = runtime ? item.titleKeyByProfile?.[runtime.profile] : undefined
  if (profileTitleKey) {
    return profileTitleKey
  }
  return item.titleKey
}
