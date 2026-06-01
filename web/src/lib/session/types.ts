export interface ServerConnectionInfo {
  serverId: string
  serverName: string
  host: string
  port?: number
  username: string
}

export type OptionalServerConnectionInfo = Omit<ServerConnectionInfo, "serverId"> & {
  serverId?: string
}
