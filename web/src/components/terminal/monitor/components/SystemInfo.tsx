/**
 * 系统信息组件
 * 显示OS、主机名、CPU、架构、负载、运行时间等基础信息
 * 支持点击复制功能
 */

import React, { useState } from 'react';
import { useTranslations } from "next-intl";
import type { SystemInfo as SystemInfoType } from '../types/metrics';
import { cn } from '@/lib/utils';

interface SystemInfoProps {
  data: SystemInfoType;
}

/**
 * 信息行组件
 */
const InfoRow: React.FC<{
  label: string;
  value: string;
  monospace?: boolean;
}> = ({ label, value, monospace = false }) => {
  const t = useTranslations("terminalMonitor");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div
      className={cn(
        "flex justify-between items-center h-5 leading-5 text-xs cursor-pointer",
        "transition-all duration-300 ease-in-out",
        "hover:bg-accent/50 rounded px-1.5 -mx-1.5",
        copied && "bg-status-connected/10"
      )}
      onClick={handleCopy}
      title={t("copyTooltip", { value })}
    >
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        "font-medium truncate ml-2",
        "transition-colors duration-300",
        monospace && "font-mono text-[11px]",
        copied && "text-status-connected"
      )}>
        {copied ? t("copyCopied") : value}
      </span>
    </div>
  );
};

/**
 * 系统信息组件
 */
export const SystemInfo: React.FC<SystemInfoProps> = React.memo(({ data }) => {
  const t = useTranslations("terminalMonitor");
  return (
    <div className="space-y-1">
      {/* 模块标题 - 高度 28px */}
      <div className="h-7 flex items-center">
        <span className="text-xs font-semibold">{t("systemInfoTitle")}</span>
      </div>

      {/* 信息列表 - 6行×20px = 120px */}
      <div className="space-y-0">
        <InfoRow label="OS" value={data.os} />
        <InfoRow label={t("labelHost")} value={data.hostname} monospace />
        <InfoRow label="CPU" value={data.cpu} />
        <InfoRow label={t("labelArch")} value={data.arch} monospace />
        <InfoRow label={t("labelLoad")} value={data.load} monospace />
        <InfoRow label={t("labelUptime")} value={data.uptime} monospace />
      </div>
    </div>
  );
});

SystemInfo.displayName = 'SystemInfo';
