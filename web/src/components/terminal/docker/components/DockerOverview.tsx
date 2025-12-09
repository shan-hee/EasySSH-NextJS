/**
 * Docker 概览组件
 */

'use client'

import { Package, Cpu, HardDrive, Server } from 'lucide-react'
import { DockerIcon } from './DockerIcon'
import type { DockerSystemInfo, DockerContainer, ContainerStats } from '../types'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

interface DockerOverviewProps {
  systemInfo: DockerSystemInfo | null
  containers: DockerContainer[]
  stats: ContainerStats[]
}

export function DockerOverview({
  systemInfo,
  containers,
  stats,
}: DockerOverviewProps) {
  const t = useTranslations('terminal')

  // 格式化内存
  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // 计算总资源使用
  const resourceUsage = useMemo(() => {
    let totalCpu = 0
    let totalMemory = 0
    stats.forEach((s) => {
      totalCpu += s.cpuPercent
      totalMemory += s.memoryUsage
    })
    return { cpu: totalCpu, memory: totalMemory }
  }, [stats])

  // 统计卡片数据
  const statCards = [
    {
      icon: DockerIcon,
      label: t('dockerOverviewRunning'),
      value: systemInfo?.containersRunning ?? containers.filter(c => c.state === 'running').length,
      color: 'text-status-connected',
    },
    {
      icon: DockerIcon,
      label: t('dockerOverviewStopped'),
      value: systemInfo?.containersStopped ?? containers.filter(c => c.state !== 'running').length,
      color: 'text-muted-foreground',
    },
    {
      icon: Package,
      label: t('dockerOverviewImages'),
      value: systemInfo?.imagesCount ?? 0,
      color: 'text-blue-500',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-2">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="rounded-lg border border-border p-2"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={cn('h-3.5 w-3.5', card.color)} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <div className="text-lg font-semibold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* 资源使用 */}
      <div className="rounded-lg border border-border p-2.5">
        <h3 className="text-sm font-medium mb-2">{t('dockerOverviewResources')}</h3>
        <div className="flex flex-col gap-2.5">
          {/* CPU */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                CPU
              </span>
              <span className="tabular-nums">{resourceUsage.cpu.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(resourceUsage.cpu, 100)}%` }}
              />
            </div>
          </div>

          {/* 内存 */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {t('dockerOverviewMemory')}
              </span>
              <span className="tabular-nums">{formatMemory(resourceUsage.memory)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-status-connected rounded-full transition-all"
                style={{
                  width: systemInfo?.totalMemory
                    ? `${Math.min((resourceUsage.memory / systemInfo.totalMemory) * 100, 100)}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 系统信息 */}
      {systemInfo && (
        <div className="rounded-lg border border-border p-2.5">
          <h3 className="text-sm font-medium mb-2">{t('dockerOverviewSystem')}</h3>
          <div className="flex flex-col gap-1.5 text-xs">
            <InfoRow
              icon={Server}
              label={t('dockerOverviewVersion')}
              value={systemInfo.serverVersion}
            />
            <InfoRow
              icon={HardDrive}
              label={t('dockerOverviewStorage')}
              value={systemInfo.storageDriver}
            />
            <InfoRow
              icon={Cpu}
              label="CPUs"
              value={String(systemInfo.cpus)}
            />
            <InfoRow
              icon={HardDrive}
              label={t('dockerOverviewTotalMemory')}
              value={formatMemory(systemInfo.totalMemory)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
