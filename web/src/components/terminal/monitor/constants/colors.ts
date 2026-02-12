export const MONITOR_COLORS = {
  cpu: {
    usage: "oklch(0.64 0.17 214)",
  },
  memory: {
    ram: "oklch(0.72 0.18 50)",
    swap: "oklch(0.63 0.21 12)",
  },
  network: {
    download: "oklch(0.62 0.17 259)",
    upload: "oklch(0.58 0.14 162)",
  },
  disk: {
    usedPalette: [
      "oklch(0.68 0.16 132)",
      "oklch(0.67 0.16 332)",
      "oklch(0.62 0.15 226)",
      "oklch(0.72 0.17 78)",
      "oklch(0.63 0.15 294)",
    ],
    freeSegment: "rgba(148,163,184,0.24)",
  },
} as const;
