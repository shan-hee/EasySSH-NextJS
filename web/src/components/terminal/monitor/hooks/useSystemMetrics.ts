/**
 * 系统监控数据模拟 Hook
 * 生成实时更新的模拟监控数据
 */

import { useState, useEffect, useMemo } from 'react';
import type { SystemMetrics, CPUData, NetworkData } from '../types/metrics';

/**
 * 生成随机数值 (带范围)
 */
function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 格式化时间为 HH:MM:SS
 */
function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0];
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * 生成初始 CPU 历史数据
 */
function generateInitialCPUData(count: number): CPUData[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const time = new Date(now.getTime() - (count - 1 - i) * 2000);
    return {
      time: formatTime(time),
      usage: Math.round(random(20, 60)),
    };
  });
}

/**
 * 生成初始网络历史数据
 */
function generateInitialNetworkData(count: number): NetworkData[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const time = new Date(now.getTime() - (count - 1 - i) * 2000);
    return {
      time: formatTime(time),
      download: Math.round(random(100, 2000)),
      upload: Math.round(random(50, 500)),
    };
  });
}

/**
 * 系统监控数据 Hook
 */
export function useSystemMetrics() {
  // 初始化 CPU 历史数据 - 改为10个数据点
  const [cpuHistory, setCpuHistory] = useState<CPUData[]>(() =>
    generateInitialCPUData(10)
  );

  // 初始化网络历史数据 - 改为10个数据点
  const [networkHistory, setNetworkHistory] = useState<NetworkData[]>(() =>
    generateInitialNetworkData(10)
  );

  // 系统信息 (静态数据,60秒更新一次)
  const [systemInfo, setSystemInfo] = useState({
    os: 'Ubuntu 22.04.3 LTS',
    hostname: 'web-server-01',
    cpu: 'Intel Core i7-9700K',
    arch: 'x86_64',
    load: '0.45, 0.32, 0.28',
    uptime: formatUptime(1323780), // 约15天
  });

  // 内存数据
  const [memory, setMemory] = useState({
    ram: {
      used: 10.8,
      total: 16,
      percent: 68,
    },
    swap: {
      used: 2.4,
      total: 8,
      percent: 30,
    },
  });

  // 磁盘数据 (30秒更新一次)
  const [disks, setDisks] = useState([
    {
      name: '/ (root)',
      used: 45,
      total: 60,
      percent: 75,
    },
    {
      name: '/home',
      used: 120,
      total: 200,
      percent: 60,
    },
  ]);

  // CPU/内存/网络每2秒更新
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = formatTime(now);

      // 更新 CPU 数据
      setCpuHistory(prev => {
        const newUsage = Math.round(random(20, 85));
        const newData: CPUData = {
          time: timeStr,
          usage: newUsage,
        };
        return [...prev.slice(1), newData];
      });

      // 更新网络数据
      setNetworkHistory(prev => {
        const newData: NetworkData = {
          time: timeStr,
          download: Math.round(random(100, 3000)),
          upload: Math.round(random(50, 800)),
        };
        return [...prev.slice(1), newData];
      });

      // 更新内存数据 (小幅波动)
      setMemory(prev => ({
        ram: {
          ...prev.ram,
          used: Math.max(8, Math.min(15, prev.ram.used + random(-0.3, 0.3))),
          percent: Math.round((prev.ram.used / prev.ram.total) * 100),
        },
        swap: {
          ...prev.swap,
          used: Math.max(1, Math.min(5, prev.swap.used + random(-0.2, 0.2))),
          percent: Math.round((prev.swap.used / prev.swap.total) * 100),
        },
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 磁盘每30秒更新
  useEffect(() => {
    const interval = setInterval(() => {
      setDisks(prev =>
        prev.map(disk => {
          const newUsed = Math.max(
            disk.used - 5,
            Math.min(disk.total - 5, disk.used + random(-2, 3))
          );
          return {
            ...disk,
            used: Math.round(newUsed),
            percent: Math.round((newUsed / disk.total) * 100),
          };
        })
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // 系统信息每60秒更新
  useEffect(() => {
    let uptimeSeconds = 1323780;
    const interval = setInterval(() => {
      uptimeSeconds += 60;
      setSystemInfo(prev => ({
        ...prev,
        load: `${random(0.2, 1.5).toFixed(2)}, ${random(0.2, 1.2).toFixed(2)}, ${random(0.2, 1.0).toFixed(2)}`,
        uptime: formatUptime(uptimeSeconds),
      }));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // 组装完整数据
  const metrics: SystemMetrics = useMemo(() => {
    const currentCPU = cpuHistory[cpuHistory.length - 1]?.usage || 0;
    const currentNet = networkHistory[networkHistory.length - 1] || { download: 0, upload: 0 };

    return {
      systemInfo,
      cpuHistory,
      currentCPU,
      memory,
      networkHistory,
      currentNetwork: {
        download: currentNet.download,
        upload: currentNet.upload,
      },
      disks,
    };
  }, [systemInfo, cpuHistory, memory, networkHistory, disks]);

  return metrics;
}
