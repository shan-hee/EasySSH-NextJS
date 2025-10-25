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
