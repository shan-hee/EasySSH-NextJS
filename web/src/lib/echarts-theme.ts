"use client";

import * as React from "react";
import type { ChartConfig } from "@/components/ui/chart";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-mode";
import { colorToHex } from "@/lib/color-utils";

type ColorMap = Record<string, string>;

function resolveCssVarColor(raw: string | undefined, style: CSSStyleDeclaration): string | undefined {
  if (!raw) return undefined;

  const trimmed = raw.trim();

  // 处理 var(--xxx) 形式，解析出真正的变量值
  if (trimmed.startsWith("var(")) {
    const match = trimmed.match(/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/);
    if (match?.[1]) {
      const value = style.getPropertyValue(match[1]).trim();
      if (value) return value;
      if (match[2]) return match[2].trim();
    }
  }

  return trimmed;
}

function normalizeEchartsColor(color: string): string {
  return /^(#|rgb|hsl|oklch|oklab|lch|lab)\b|^color\(/i.test(color.trim()) ? colorToHex(color) : color;
}

function areColorMapsEqual(a: ColorMap, b: ColorMap): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * 将 ChartConfig 中的颜色配置解析为 ECharts 可用的实际颜色值
 * - 支持 color: "var(--chart-x)" 形式
 * - 支持 theme: { light, dark } 形式
 * - 自动根据当前 light/dark 主题选择颜色
 */
export function useEchartsColors(config: ChartConfig): ColorMap {
  const { mode, version } = useEffectiveThemeMode();
  const [colors, setColors] = React.useState<ColorMap>({});

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const style = getComputedStyle(root);
    const result: ColorMap = {};
    let index = 0;

    for (const [key, item] of Object.entries(config)) {
      let rawColor: string | undefined;

      if ("color" in item && item.color) {
        rawColor = item.color;
      } else if ("theme" in item && item.theme) {
        const themeKey = mode as keyof typeof item.theme;
        rawColor = item.theme[themeKey];
      }

      let color = resolveCssVarColor(rawColor, style);

      // 回退到全局 chart 调色板
      if (!color) {
        const varName = `--chart-${(index % 5) + 1}`;
        const value = style.getPropertyValue(varName).trim();
        if (value) {
          color = value;
        }
      }

      // 最终兜底颜色，避免 ECharts 收到空字符串
      if (!color) {
        color = "#4b9cff";
      }

      result[key] = normalizeEchartsColor(color);
      index += 1;
    }

    setColors((current) => (areColorMapsEqual(current, result) ? current : result));
  }, [config, mode, version]);

  return colors;
}
