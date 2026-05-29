export const MONITOR_COLORS = {
  cpu: {
    usage: "var(--chart-1)",
  },
  memory: {
    ram: "var(--chart-3)",
    swap: "var(--chart-5)",
  },
  network: {
    download: "var(--chart-1)",
    upload: "var(--chart-2)",
  },
  disk: {
    usedPalette: [
      "var(--chart-2)",
      "var(--chart-4)",
      "var(--chart-1)",
      "var(--chart-3)",
      "var(--chart-5)",
    ],
    freeSegment: "var(--muted)",
  },
} as const;
