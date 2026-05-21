import {
  Archive,
  Bot,
  Clock,
  Command,
  Globe,
  HardDrive,
  Mail,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react"
import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime"
import { hasAllCapabilities } from "@/shell/runtime"

export type SettingsTranslationKey =
  | "itemBasic"
  | "itemFileTransfer"
  | "itemCompletion"
  | "itemAccessControl"
  | "itemSessionManagement"
  | "itemTerminalSession"
  | "itemNetworkSecurity"
  | "itemAIConfig"
  | "itemNotificationConfig"
  | "itemBackup"

export type SettingsTabDefinition = {
  id: string
  nameKey: SettingsTranslationKey
  nameKeyByProfile?: Partial<Record<RuntimeProfile, SettingsTranslationKey>>
  icon: LucideIcon
  requiredCapabilities?: AppCapability[]
  profiles?: RuntimeProfile[]
}

export type SettingsTabItem = SettingsTabDefinition & {
  name: string
}

export const settingsRegistry: SettingsTabDefinition[] = [
  {
    id: "basic",
    nameKey: "itemBasic",
    icon: Settings,
    requiredCapabilities: ["settings"],
    profiles: ["web"],
  },
  {
    id: "file-transfer",
    nameKey: "itemFileTransfer",
    icon: HardDrive,
    requiredCapabilities: ["sftp"],
  },
  {
    id: "completion",
    nameKey: "itemCompletion",
    icon: Command,
    requiredCapabilities: ["terminal"],
  },
  {
    id: "access-control",
    nameKey: "itemAccessControl",
    icon: Shield,
    requiredCapabilities: ["security_policy"],
  },
  {
    id: "session",
    nameKey: "itemSessionManagement",
    nameKeyByProfile: {
      desktop: "itemTerminalSession",
    },
    icon: Clock,
    requiredCapabilities: ["settings"],
  },
  {
    id: "network",
    nameKey: "itemNetworkSecurity",
    icon: Globe,
    requiredCapabilities: ["security_policy"],
  },
  {
    id: "ai-config",
    nameKey: "itemAIConfig",
    icon: Bot,
    requiredCapabilities: ["ai"],
  },
  {
    id: "notification-config",
    nameKey: "itemNotificationConfig",
    icon: Mail,
    requiredCapabilities: ["notifications"],
  },
  {
    id: "backup",
    nameKey: "itemBackup",
    icon: Archive,
    requiredCapabilities: ["backup"],
  },
]

export function buildSettingsTabs(params: {
  runtime?: RuntimeInfo | null
  t: (key: SettingsTranslationKey) => string
}): SettingsTabItem[] {
  const { runtime, t } = params

  return settingsRegistry
    .filter((tab) => isSettingsTabVisible(tab, runtime))
    .map((tab) => ({
      ...tab,
      name: t(tab.nameKeyByProfile?.[runtime?.profile ?? "web"] ?? tab.nameKey),
    }))
}

function isSettingsTabVisible(
  tab: SettingsTabDefinition,
  runtime: RuntimeInfo | null | undefined,
): boolean {
  if (runtime && tab.profiles && !tab.profiles.includes(runtime.profile)) {
    return false
  }
  if (runtime && !hasAllCapabilities(runtime, tab.requiredCapabilities)) {
    return false
  }
  return true
}
