"use client";

import * as React from "react";

import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-mode";
import { colorToHex, hexToRgb } from "@/lib/color-utils";

type MonitorChartTheme = {
  cpu: string;
  ram: string;
  swap: string;
  download: string;
  upload: string;
  diskPalette: string[];
  freeSegment: string;
  freeSegmentStrong: string;
  axisLabel: string;
  gridLine: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  pointFill: string;
  danger: string;
  warning: string;
  shadow: string;
};

const DEFAULT_MONITOR_CHART_THEME: MonitorChartTheme = {
  cpu: "#3f6ee8",
  ram: "#d8891f",
  swap: "#d9467a",
  download: "#3f6ee8",
  upload: "#24966c",
  diskPalette: ["#24966c", "#9b5de5", "#3f6ee8", "#d8891f", "#d9467a"],
  freeSegment: "rgba(100, 116, 139, 0.18)",
  freeSegmentStrong: "rgba(100, 116, 139, 0.24)",
  axisLabel: "rgba(100, 116, 139, 0.9)",
  gridLine: "rgba(100, 116, 139, 0.24)",
  tooltipBackground: "rgba(255, 255, 255, 0.96)",
  tooltipBorder: "rgba(100, 116, 139, 0.22)",
  tooltipText: "#0f172a",
  pointFill: "#ffffff",
  danger: "#dc2626",
  warning: "#ca8a04",
  shadow: "rgba(15, 23, 42, 0.12)",
};

function cssColor(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return colorToHex(value || fallback);
}

function alpha(color: string, opacity: number): string {
  const rgb = hexToRgb(color) ?? hexToRgb(colorToHex(color)) ?? [0, 0, 0];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
}

function readMonitorChartTheme(): MonitorChartTheme {
  if (typeof window === "undefined") {
    return DEFAULT_MONITOR_CHART_THEME;
  }

  const style = getComputedStyle(document.documentElement);
  const background = cssColor(style, "--background", DEFAULT_MONITOR_CHART_THEME.pointFill);
  const popover = cssColor(style, "--popover", DEFAULT_MONITOR_CHART_THEME.tooltipBackground);
  const popoverForeground = cssColor(style, "--popover-foreground", DEFAULT_MONITOR_CHART_THEME.tooltipText);
  const mutedForeground = cssColor(style, "--muted-foreground", "#64748b");

  return {
    cpu: cssColor(style, "--chart-1", DEFAULT_MONITOR_CHART_THEME.cpu),
    ram: cssColor(style, "--chart-3", DEFAULT_MONITOR_CHART_THEME.ram),
    swap: cssColor(style, "--chart-5", DEFAULT_MONITOR_CHART_THEME.swap),
    download: cssColor(style, "--chart-1", DEFAULT_MONITOR_CHART_THEME.download),
    upload: cssColor(style, "--chart-2", DEFAULT_MONITOR_CHART_THEME.upload),
    diskPalette: [
      cssColor(style, "--chart-2", DEFAULT_MONITOR_CHART_THEME.diskPalette[0]),
      cssColor(style, "--chart-4", DEFAULT_MONITOR_CHART_THEME.diskPalette[1]),
      cssColor(style, "--chart-1", DEFAULT_MONITOR_CHART_THEME.diskPalette[2]),
      cssColor(style, "--chart-3", DEFAULT_MONITOR_CHART_THEME.diskPalette[3]),
      cssColor(style, "--chart-5", DEFAULT_MONITOR_CHART_THEME.diskPalette[4]),
    ],
    freeSegment: alpha(mutedForeground, 0.18),
    freeSegmentStrong: alpha(mutedForeground, 0.24),
    axisLabel: alpha(mutedForeground, 0.9),
    gridLine: alpha(mutedForeground, 0.24),
    tooltipBackground: alpha(popover, 0.96),
    tooltipBorder: alpha(mutedForeground, 0.22),
    tooltipText: popoverForeground,
    pointFill: background,
    danger: cssColor(style, "--destructive", DEFAULT_MONITOR_CHART_THEME.danger),
    warning: cssColor(style, "--status-warning", DEFAULT_MONITOR_CHART_THEME.warning),
    shadow: alpha(mutedForeground, 0.14),
  };
}

function areMonitorThemesEqual(a: MonitorChartTheme, b: MonitorChartTheme): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useMonitorChartTheme(): MonitorChartTheme {
  const { mode, version } = useEffectiveThemeMode();
  const [theme, setTheme] = React.useState<MonitorChartTheme>(() => readMonitorChartTheme());

  React.useEffect(() => {
    const nextTheme = readMonitorChartTheme();
    setTheme((current) => (areMonitorThemesEqual(current, nextTheme) ? current : nextTheme));
  }, [mode, version]);

  return theme;
}
