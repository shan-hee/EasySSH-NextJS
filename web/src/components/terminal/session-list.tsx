"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Activity,
  MoreHorizontal,
  Terminal,
  Unplug,
  RefreshCw,
  Search,
  X
} from "lucide-react"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"

interface Session {
  id: string
  serverId: number
  serverName: string
  host: string
  port: number
  username: string
  status: "connected" | "disconnected" | "connecting" | "error"
  startTime: string
  lastActivity: string
  duration: string
  commandsCount: number
  dataTransferred: string
}

interface SessionListProps {
  sessions: Session[]
  onDisconnect: (sessionId: string) => void
  onReconnect: (sessionId: string) => void
  onViewDetails: (sessionId: string) => void
  onForceDisconnect: (sessionId: string) => void
}

export function SessionList({
  sessions,
  onDisconnect,
  onReconnect,
  onViewDetails,
  onForceDisconnect
}: SessionListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const { user } = useClientAuth()
  const { config } = useSystemConfig()
  const effectiveLocale = getEffectiveLocale(user, config)
  const effectiveTimezone = getEffectiveTimezone(user, config)
  const t = useTranslations("terminalSessions")
  const tCommon = useTranslations("common")

  const filteredSessions = sessions.filter(session =>
    session.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            {t("statusActive")}
          </Badge>
        )
      case "disconnected":
        return <Badge variant="secondary">{t("statusClosed")}</Badge>
      case "connecting":
        return (
          <Badge variant="outline" className="animate-pulse">
            {t("statusConnecting")}
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">{t("statusError")}</Badge>
      default:
        return <Badge variant="secondary">{t("statusUnknown")}</Badge>
    }
  }

  const getActivityIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Activity className="h-4 w-4 text-green-500 animate-pulse" />
      case "connecting":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <X className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t("panelTitle", { count: sessions.length })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              {tCommon("refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8">
            <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {sessions.length === 0 ? t("empty") : t("emptyNoMatchTitle")}
            </h3>
            <p className="text-muted-foreground">
              {sessions.length === 0
                ? t("emptyNoSessionsDescription")
                : t("emptyNoMatchDescription")
              }
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colServer")}</TableHead>
                <TableHead>{t("colConnectionInfo")}</TableHead>
                <TableHead>{t("colConnectedAt")}</TableHead>
                <TableHead>{t("colDuration")}</TableHead>
                <TableHead>{t("colActivity")}</TableHead>
                <TableHead>{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActivityIcon(session.status)}
                      {getStatusBadge(session.status)}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium">{session.serverName}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {session.serverId}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-mono text-sm">
                      <div>{session.username}@{session.host}:{session.port}</div>
                      <div className="text-muted-foreground">
                        会话: {session.id}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm font-mono">
                      {formatInTimezone(session.startTime, {}, effectiveLocale, effectiveTimezone)}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {session.duration}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      <div>
                        {t("fieldCommandsLabel")}: {session.commandsCount}
                      </div>
                      <div className="text-muted-foreground">
                        {t("fieldDataTransferredLabel")}: {session.dataTransferred}
                      </div>
                      <div className="text-muted-foreground">
                        {t("fieldLastActivityLabel")}:{" "}
                        {formatInTimezone(
                          session.lastActivity,
                          {},
                          effectiveLocale,
                          effectiveTimezone,
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(session.id)}>
                          {t("actionViewDetails")}
                        </DropdownMenuItem>

                        {session.status === "connected" && (
                          <>
                            <DropdownMenuItem onClick={() => onDisconnect(session.id)}>
                              <Unplug className="h-4 w-4 mr-2" />
                              {t("actionDisconnect")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onForceDisconnect(session.id)}
                              className="text-destructive"
                            >
                              {t("actionForceDisconnect")}
                            </DropdownMenuItem>
                          </>
                        )}

                        {session.status === "disconnected" && (
                          <DropdownMenuItem onClick={() => onReconnect(session.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {t("actionReconnect")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* 会话详情对话框 */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {selectedSession &&
                t("dialogDescription", { id: selectedSession.id })}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">
                    {t("sectionConnectionInfoTitle")}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      {t("fieldServer")}: {selectedSession.serverName}
                    </div>
                    <div>
                      {t("fieldAddress")}: {selectedSession.host}:{selectedSession.port}
                    </div>
                    <div>
                      {t("fieldUser")}: {selectedSession.username}
                    </div>
                    <div>
                      {t("fieldStatus")}: {getStatusBadge(selectedSession.status)}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">
                    {t("sectionStatsTitle")}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      {t("fieldStartTime")}:{" "}
                      {formatInTimezone(
                        selectedSession.startTime,
                        {},
                        effectiveLocale,
                        effectiveTimezone,
                      )}
                    </div>
                    <div>
                      {t("fieldDuration")}: {selectedSession.duration}
                    </div>
                    <div>
                      {t("fieldCommands")}: {selectedSession.commandsCount}
                    </div>
                    <div>
                      {t("fieldDataTransferred")}: {selectedSession.dataTransferred}
                    </div>
                    <div>
                      {t("fieldLastActivity")}:{" "}
                      {formatInTimezone(
                        selectedSession.lastActivity,
                        {},
                        effectiveLocale,
                        effectiveTimezone,
                      )}
                    </div>
                    {selectedSession.exitCode != null && (
                      <div>
                        {t("fieldExitCode")}: {selectedSession.exitCode}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
