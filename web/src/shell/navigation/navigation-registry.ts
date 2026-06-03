import type { LucideIcon } from "lucide-react"
import {
  Bot,
  CalendarClock,
  FileText,
  FolderOpen,
  Monitor,
  ScrollText,
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
}

export interface NavigationItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
}

export interface NavigationGroups {
  workbench: NavigationItem[]
  systemOrg: NavigationItem[]
}

const workbench: NavigationItemDefinition[] = [
  {
    titleKey: "console",
    url: "/dashboard",
    icon: Monitor,
    isActive: true,
  },
  {
    titleKey: "aiAssistant",
    url: "/dashboard/ai-assistant",
    icon: Bot,
    requiredCapabilities: ["ai"],
  },
  {
    titleKey: "terminal",
    url: "/dashboard/terminal",
    icon: Terminal,
    requiredCapabilities: ["servers", "terminal"],
  },
  {
    titleKey: "fileManager",
    url: "/dashboard/sftp",
    icon: FolderOpen,
    requiredCapabilities: ["sftp"],
  },
  {
    titleKey: "scripts",
    url: "/dashboard/scripts",
    icon: ScrollText,
    requiredCapabilities: ["scripts"],
  },
  {
    titleKey: "schedules",
    url: "/dashboard/automation/schedules",
    icon: CalendarClock,
    requiredCapabilities: ["automation"],
  },
  {
    titleKey: "operationLogs",
    url: "/dashboard/operation-logs",
    icon: ScrollText,
  },
]

const systemOrg: NavigationItemDefinition[] = [
  {
    titleKey: "userManagement",
    url: "/dashboard/users",
    icon: Users,
    adminOnly: true,
    profiles: ["web"],
    requiredCapabilities: ["users"],
  },
  {
    titleKey: "logs",
    url: "/dashboard/logs",
    icon: FileText,
    adminOnly: true,
    profiles: ["web"],
    requiredCapabilities: ["audit"],
  },
  {
    titleKey: "systemSettings",
    url: "/dashboard/settings",
    icon: Settings,
    adminOnly: true,
    profiles: ["web"],
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
    systemOrg: translateNavigationItems(systemOrg, runtime, isAdmin, t),
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

    return [{
      title: t(item.titleKey),
      url: item.url,
      icon: item.icon,
      isActive: item.isActive,
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
