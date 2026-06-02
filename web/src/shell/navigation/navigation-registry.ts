import type { LucideIcon } from "lucide-react"
import {
  FileText,
  FolderOpen,
  Monitor,
  Server,
  Settings,
  Terminal,
  Users,
} from "lucide-react"
import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime/types"
import { hasAllCapabilities } from "@/shell/runtime/capabilities"

export type NavigationTranslation = (key: string) => string

export interface NavigationItemDefinition {
  titleKey: string
  url: string
  icon?: LucideIcon
  requiredCapabilities?: AppCapability[]
  profiles?: RuntimeProfile[]
  adminOnly?: boolean
  isActive?: boolean
  items?: NavigationItemDefinition[]
}

export interface NavigationItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: NavigationItem[]
}

export interface NavigationGroups {
  workbench: NavigationItem[]
  core: NavigationItem[]
  observeAudit: NavigationItem[]
  settings: NavigationItem[]
}

const workbench: NavigationItemDefinition[] = [
  {
    titleKey: "console",
    url: "/dashboard",
    icon: Monitor,
    isActive: true,
  },
]

const core: NavigationItemDefinition[] = [
  {
    titleKey: "connections",
    url: "#",
    icon: Server,
    requiredCapabilities: ["servers"],
    items: [
      { titleKey: "connectionConfigs", url: "/dashboard/servers", requiredCapabilities: ["servers"] },
      { titleKey: "connectionHistory", url: "/dashboard/servers/history", requiredCapabilities: ["servers"] },
    ],
  },
  {
    titleKey: "terminal",
    url: "/dashboard/terminal",
    icon: Terminal,
    profiles: ["desktop"],
    requiredCapabilities: ["terminal"],
  },
  {
    titleKey: "automation",
    url: "#",
    icon: Terminal,
    requiredCapabilities: ["scripts"],
    items: [
      { titleKey: "scripts", url: "/dashboard/scripts", requiredCapabilities: ["scripts"] },
      { titleKey: "schedules", url: "/dashboard/automation/schedules", requiredCapabilities: ["automation"] },
      { titleKey: "executions", url: "/dashboard/automation/history", requiredCapabilities: ["automation"] },
    ],
  },
  {
    titleKey: "file",
    url: "#",
    icon: FolderOpen,
    requiredCapabilities: ["sftp"],
    items: [
      { titleKey: "fileManager", url: "/dashboard/sftp", requiredCapabilities: ["sftp"] },
      { titleKey: "transferHistory", url: "/dashboard/transfers/history", requiredCapabilities: ["transfers"] },
      { titleKey: "trash", url: "/dashboard/storage", requiredCapabilities: ["sftp"] },
    ],
  },
]

const observeAudit: NavigationItemDefinition[] = [
  {
    titleKey: "logs",
    url: "#",
    icon: FileText,
    requiredCapabilities: ["audit"],
    items: [
      { titleKey: "logsOperations", url: "/dashboard/logs", requiredCapabilities: ["audit"] },
      { titleKey: "logsLogin", url: "/dashboard/logs/login", requiredCapabilities: ["login_logs"] },
    ],
  },
]

const settings: NavigationItemDefinition[] = [
  {
    titleKey: "userManagement",
    url: "/dashboard/users",
    icon: Users,
    adminOnly: true,
    requiredCapabilities: ["users"],
  },
  {
    titleKey: "systemSettings",
    url: "/dashboard/settings",
    icon: Settings,
    adminOnly: true,
    requiredCapabilities: ["settings"],
  },
]

export function buildNavigationGroups({
  runtime,
  isAdmin,
  t,
}: {
  runtime: RuntimeInfo | null | undefined
  isAdmin: boolean
  t: NavigationTranslation
}): NavigationGroups {
  return {
    workbench: translateNavigationItems(workbench, runtime, isAdmin, t),
    core: translateNavigationItems(core, runtime, isAdmin, t),
    observeAudit: translateNavigationItems(observeAudit, runtime, isAdmin, t),
    settings: translateNavigationItems(settings, runtime, isAdmin, t),
  }
}

function translateNavigationItems(
  items: NavigationItemDefinition[],
  runtime: RuntimeInfo | null | undefined,
  isAdmin: boolean,
  t: NavigationTranslation,
): NavigationItem[] {
  return items.flatMap((item) => {
    if (item.adminOnly && !isAdmin) {
      return []
    }
    if (!matchesCapabilities(runtime, item.requiredCapabilities)) {
      return []
    }
    if (!matchesProfiles(runtime, item.profiles)) {
      return []
    }

    const children = item.items
      ? translateNavigationItems(item.items, runtime, isAdmin, t)
      : undefined
    if (item.items && (!children || children.length === 0)) {
      return []
    }

    return [{
      title: t(item.titleKey),
      url: item.url,
      icon: item.icon,
      isActive: item.isActive,
      items: children,
    }]
  })
}

function matchesProfiles(
  runtime: RuntimeInfo | null | undefined,
  profiles: RuntimeProfile[] | readonly RuntimeProfile[] | undefined,
) {
  if (!profiles || profiles.length === 0) {
    return true
  }
  if (!runtime) {
    return false
  }

  return profiles.includes(runtime.profile)
}

function matchesCapabilities(
  runtime: RuntimeInfo | null | undefined,
  capabilities: AppCapability[] | readonly AppCapability[] | undefined,
) {
  if (!runtime) {
    return true
  }

  return hasAllCapabilities(runtime, capabilities)
}
