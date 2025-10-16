"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ServerCard } from "./server-card"

interface ServerData {
  id: number
  name: string
  host: string
  port: number
  username: string
  status: 'online' | 'offline' | 'warning'
  os: string
  cpu: string
  memory: string
  disk: string
  lastConnected: string
  uptime: string
  tags: string[]
}

interface DraggableServerCardProps {
  server: ServerData
  onConnect?: (serverId: number) => void
  onEdit?: (serverId: number) => void
  onDelete?: (serverId: number) => void
  onViewDetails?: (serverId: number) => void
}

export function DraggableServerCard({
  server,
  onConnect,
  onEdit,
  onDelete,
  onViewDetails
}: DraggableServerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <ServerCard
        server={server}
        onConnect={onConnect}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewDetails={onViewDetails}
      />
    </div>
  )
}
