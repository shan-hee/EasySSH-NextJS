/**
 * 格式化工具函数
 * 用于智能转换和显示数据单位
 */

/**
 * 格式化字节大小，自动选择合适的单位
 * @param bytes 字节数
 * @param decimals 小数位数，默认 2
 * @returns 格式化后的字符串和数值对象
 */
export function formatBytes(bytes: number, decimals: number = 2): { value: number; unit: string; formatted: string } {
  if (bytes === 0) return { value: 0, unit: 'B', formatted: '0 B' };

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  const unit = sizes[i];

  return {
    value,
    unit,
    formatted: `${value} ${unit}`,
  };
}

/**
 * 格式化字节大小，返回带单位的字符串
 * @param bytes 字节数
 * @param decimals 小数位数，默认 2
 * @returns 格式化后的字符串，例如 "3.28 GB"
 */
export function formatBytesString(bytes: number, decimals: number = 2): string {
  return formatBytes(bytes, decimals).formatted;
}

/**
 * 格式化速率（字节/秒），自动选择合适的单位
 * @param bytesPerSec 每秒字节数
 * @param decimals 小数位数，默认 1
 * @returns 格式化后的字符串，例如 "1.5 MB/s"
 */
export function formatSpeed(bytesPerSec: number, decimals: number = 1): string {
  if (bytesPerSec === 0) return '0 B/s';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const value = parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(dm));

  return `${value} ${sizes[i]}`;
}

/**
 * 解析文件大小字符串为字节数
 * @param sizeStr 大小字符串，例如 "1.5 MB", "500 KB"
 * @returns 字节数，解析失败返回 0
 */
export function parseFileSize(sizeStr: string): number {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;

  // 移除前后空格并转换为大写
  const str = sizeStr.trim().toUpperCase();

  // 匹配数字和单位
  const match = str.match(/^([\d.]+)\s*([KMGTP]?B?)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'B';

  // 单位转换表
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'K': 1024,
    'MB': 1024 ** 2,
    'M': 1024 ** 2,
    'GB': 1024 ** 3,
    'G': 1024 ** 3,
    'TB': 1024 ** 4,
    'T': 1024 ** 4,
    'PB': 1024 ** 5,
    'P': 1024 ** 5,
  };

  const multiplier = multipliers[unit] || 1;
  return Math.floor(value * multiplier);
}

/**
 * 比较两个文件大小字符串
 * @param sizeA 大小字符串A
 * @param sizeB 大小字符串B
 * @returns 负数表示A<B，0表示相等，正数表示A>B
 */
export function compareFileSizes(sizeA: string, sizeB: string): number {
  const bytesA = parseFileSize(sizeA);
  const bytesB = parseFileSize(sizeB);
  return bytesA - bytesB;
}

/**
 * 格式化剩余时间
 * @param seconds 秒数
 * @returns 格式化后的字符串，例如 "00:15", "01:23:45"
 */
export function formatRemainingTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
