/**
 * 系统监控数据类型定义
 */

/**
 * 系统基础信息
 */
export interface SystemInfo {
  os: string;          // 操作系统 "Ubuntu 22.04 LTS"
  hostname: string;    // 主机名 "web-server-01"
  cpu: string;         // CPU型号 "Intel Core i7-9700K"
  arch: string;        // 架构 "x86_64"
  load: string;        // 系统负载 "0.45, 0.32, 0.28"
  uptime: string;      // 运行时间 "15d 6h 23m"
}

/**
 * CPU使用率数据点
 */
export interface CPUData {
  time: string;        // 时间 "14:23:45"
  usage: number;       // 使用率 0-100
}

/**
 * 内存使用数据
 */
export interface MemoryData {
  ram: {
    used: number;      // 已使用 GB
    total: number;     // 总容量 GB
    percent: number;   // 使用率 0-100
  };
  swap: {
    used: number;      // 已使用 GB
    total: number;     // 总容量 GB
    percent: number;   // 使用率 0-100
  };
}

/**
 * 网络流量数据点
 */
export interface NetworkData {
  time: string;        // 时间
  download: number;    // 下行速率 KB/s
  upload: number;      // 上行速率 KB/s
}

/**
 * 磁盘使用数据
 */
export interface DiskData {
  name: string;        // 挂载点名称 "/" 或 "/home"
  used: number;        // 已使用 GB
  total: number;       // 总容量 GB
  percent: number;     // 使用率 0-100
}

/**
 * 完整的系统指标数据
 */
export interface SystemMetrics {
  systemInfo: SystemInfo;
  cpuHistory: CPUData[];
  currentCPU: number;
  memory: MemoryData;
  networkHistory: NetworkData[];
  currentNetwork: {
    download: number;
    upload: number;
  };
  disks: DiskData[];
}
