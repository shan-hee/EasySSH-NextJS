/**
 * 系统信息组件
 * 显示OS、主机名、CPU、架构、负载、运行时间等基础信息
 * 支持点击复制功能
 */

import React, { useState } from 'react';
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
        "flex justify-between items-center h-6 leading-6 text-xs cursor-pointer transition-colors",
        "hover:bg-accent/50 rounded px-1.5 -mx-1.5",
        copied && "bg-green-500/10"
      )}
      onClick={handleCopy}
      title={`点击复制: ${value}`}
    >
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        "font-medium truncate ml-2",
        monospace && "font-mono text-[11px]",
        copied && "text-green-500"
      )}>
        {copied ? '已复制!' : value}
      </span>
    </div>
  );
};

/**
 * 系统信息组件
 */
export const SystemInfo: React.FC<SystemInfoProps> = React.memo(({ data }) => {
  return (
    <div className="space-y-0">
      {/* 模块标题 */}
      <div className="h-6 flex items-center mb-1">
        <span className="text-xs font-medium">系统信息</span>
      </div>

      {/* 信息列表 - 6行×24px = 144px */}
      <div className="space-y-0">
        <InfoRow label="OS" value={data.os} />
        <InfoRow label="主机" value={data.hostname} monospace />
        <InfoRow label="CPU" value={data.cpu} />
        <InfoRow label="架构" value={data.arch} monospace />
        <InfoRow label="负载" value={data.load} monospace />
        <InfoRow label="运行" value={data.uptime} monospace />
      </div>
    </div>
  );
});

SystemInfo.displayName = 'SystemInfo';
