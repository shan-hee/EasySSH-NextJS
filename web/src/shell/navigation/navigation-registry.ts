import type { LucideIcon } from "lucide-react"
import {
  Archive,
  CalendarClock,
  ClipboardList,
  FileClock,
  FileText,
  FolderOpen,
  History,
  Monitor,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
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
  session: NavigationItem[]
  automation: NavigationItem[]
  records: NavigationItem[]
  governance: NavigationItem[]
}

const workbench: NavigationItemDefinition[] = [
  {
    titleKey: "console",
    url: "/dashboard",
    icon: Monitor,
    isActive: true,
  },
]

const session: NavigationItemDefinition[] = [
  {
    titleKey: "connectionConfigs",
    url: "/dashboard/servers",
    icon: Server,
    requiredCapabilities: ["servers"],
  },
  {
    titleKey: "terminal",
    url: "/dashboard/terminal",
    icon: Terminal,
    requiredCapabilities: ["terminal"],
  },
  {
    titleKey: "fileManager",
    url: "/dashboard/sftp",
    icon: FolderOpen,
    requiredCapabilities: ["sftp"],
  },
]

const automation: NavigationItemDefinition[] = [
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
]

const records: NavigationItemDefinition[] = [
  {
    titleKey: "connectionHistory",
    url: "/dashboard/servers/history",
    icon: History,
    requiredCapabilities: ["servers"],
  },
  {
    titleKey: "transferHistory",
    url: "/dashboard/transfers/history",
    icon: FileClock,
    requiredCapabilities: ["transfers"],
  },
  {
    titleKey: "executions",
    url: "/dashboard/automation/history",
    icon: ClipboardList,
    requiredCapabilities: ["automation"],
  },
  {
    titleKey: "activity",
    url: "/dashboard/activity",
    icon: FileText,
    requiredCapabilities: ["activity_log"],
  },
  {
    titleKey: "trash",
    url: "/dashboard/storage",
    icon: Archive,
    requiredCapabilities: ["sftp"],
  },
]

const governance: NavigationItemDefinition[] = [
  {
    titleKey: "audit",
    url: "/dashboard/audit",
    icon: ShieldCheck,
    adminOnly: true,
    profiles: ["web"],
    requiredCapabilities: ["audit"],
  },
  {
    titleKey: "userManagement",
    url: "/dashboard/users",
    icon: Users,
    adminOnly: true,
    profiles: ["web"],
    requiredCapabilities: ["users"],
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
    session: translateNavigationItems(session, runtime, isAdmin, t),
    automation: translateNavigationItems(automation, runtime, isAdmin, t),
    records: translateNavigationItems(records, runtime, isAdmin, t),
    governance: translateNavigationItems(governance, runtime, isAdmin, t),
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
