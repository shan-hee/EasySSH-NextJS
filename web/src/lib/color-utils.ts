export type RGB = [number, number, number]

export function colorToHex(color: string): string {
  const value = color.trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value
  }
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`
  }
  if (/^#[0-9a-f]{8}$/i.test(value)) {
    return value.slice(0, 7)
  }

  const rgb =
    parseRgb(value) ??
    parseHsl(value) ??
    parseOklch(value) ??
    parseOklab(value) ??
    parseLch(value) ??
    parseLab(value) ??
    parseSrgbColor(value)
  if (!rgb) {
    return "#000000"
  }

  return rgbToHex(rgb)
}

export function hexToRgb(value: string): RGB | null {
  const hex = colorToHex(value)
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) {
    return null
  }

  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)]
}

export function rgbToHex(rgb: RGB): string {
  return `#${rgb.map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("")}`
}

export function mixHexColors(from: string, to: string, amount: number): string {
  const fromRgb = hexToRgb(from) ?? [0, 0, 0]
  const toRgb = hexToRgb(to) ?? [255, 255, 255]
  const weight = clamp(amount, 0, 1)

  return rgbToHex([
    fromRgb[0] + (toRgb[0] - fromRgb[0]) * weight,
    fromRgb[1] + (toRgb[1] - fromRgb[1]) * weight,
    fromRgb[2] + (toRgb[2] - fromRgb[2]) * weight,
  ])
}

export function contrastRatio(color: string, background: string): number {
  const colorLum = relativeLuminance(hexToRgb(color) ?? [0, 0, 0])
  const backgroundLum = relativeLuminance(hexToRgb(background) ?? [0, 0, 0])
  const lighter = Math.max(colorLum, backgroundLum)
  const darker = Math.min(colorLum, backgroundLum)

  return (lighter + 0.05) / (darker + 0.05)
}

export function ensureContrast(color: string, background: string, minimumRatio: number): string {
  const normalized = colorToHex(color)
  const normalizedBackground = colorToHex(background)
  if (contrastRatio(normalized, normalizedBackground) >= minimumRatio) {
    return normalized
  }

  const backgroundIsLight = relativeLuminance(hexToRgb(normalizedBackground) ?? [255, 255, 255]) > 0.5
  const target = backgroundIsLight ? "#000000" : "#ffffff"

  for (let step = 0.12; step <= 1; step += 0.08) {
    const mixed = mixHexColors(normalized, target, step)
    if (contrastRatio(mixed, normalizedBackground) >= minimumRatio) {
      return mixed
    }
  }

  return target
}

function parseRgb(value: string): RGB | null {
  const match = /rgba?\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1]
    .replace(/,/g, " ")
    .split("/")[0]
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))

  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }

  return [clamp(Math.round(parts[0]), 0, 255), clamp(Math.round(parts[1]), 0, 255), clamp(Math.round(parts[2]), 0, 255)]
}

function parseHsl(value: string): RGB | null {
  const match = /hsla?\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1]
    .replace(/,/g, " ")
    .split("/")[0]
    .trim()
    .split(/\s+/)

  if (parts.length < 3) {
    return null
  }

  const h = parts[0] === "none" ? 0 : Number.parseFloat(parts[0])
  const s = Number.parseFloat(parts[1].replace("%", "")) / 100
  const l = Number.parseFloat(parts[2].replace("%", "")) / 100

  if (![h, s, l].every((part) => Number.isFinite(part))) {
    return null
  }

  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return [
    clamp(Math.round((r + m) * 255), 0, 255),
    clamp(Math.round((g + m) * 255), 0, 255),
    clamp(Math.round((b + m) * 255), 0, 255),
  ]
}

function parseOklch(value: string): RGB | null {
  const match = /oklch\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0])
  const c = Number.parseFloat(parts[1])
  const h = parts[2] === "none" ? 0 : Number.parseFloat(parts[2])

  if (![l, c, h].every((part) => Number.isFinite(part))) {
    return null
  }

  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)

  return oklabToRgb(l, a, b)
}

function parseOklab(value: string): RGB | null {
  const match = /oklab\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0])
  const a = Number.parseFloat(parts[1])
  const b = Number.parseFloat(parts[2])

  if (![l, a, b].every((part) => Number.isFinite(part))) {
    return null
  }

  return oklabToRgb(l, a, b)
}

function oklabToRgb(l: number, a: number, b: number): RGB {
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = lPrime ** 3
  const m3 = mPrime ** 3
  const s3 = sPrime ** 3

  const linearR = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const linearG = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const linearB = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  return [
    clamp(Math.round(linearToSrgb(linearR) * 255), 0, 255),
    clamp(Math.round(linearToSrgb(linearG) * 255), 0, 255),
    clamp(Math.round(linearToSrgb(linearB) * 255), 0, 255),
  ]
}

function parseLch(value: string): RGB | null {
  const match = /lch\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) : Number.parseFloat(parts[0])
  const c = Number.parseFloat(parts[1])
  const h = parts[2] === "none" ? 0 : Number.parseFloat(parts[2])

  if (![l, c, h].every((part) => Number.isFinite(part))) {
    return null
  }

  return labToRgb(l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180))
}

function parseLab(value: string): RGB | null {
  const match = /lab\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) : Number.parseFloat(parts[0])
  const a = Number.parseFloat(parts[1])
  const b = Number.parseFloat(parts[2])

  if (![l, a, b].every((part) => Number.isFinite(part))) {
    return null
  }

  return labToRgb(l, a, b)
}

function labToRgb(l: number, a: number, b: number): RGB {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200

  const xr = labPivotInverse(fx)
  const yr = labPivotInverse(fy)
  const zr = labPivotInverse(fz)

  // CSS lab() uses D50; convert to D65 before sRGB conversion.
  const xD50 = xr * 0.96422
  const yD50 = yr
  const zD50 = zr * 0.82521

  const x = 0.9555766 * xD50 - 0.0230393 * yD50 + 0.0631636 * zD50
  const y = -0.0282895 * xD50 + 1.0099416 * yD50 + 0.0210077 * zD50
  const z = 0.0122982 * xD50 - 0.0204830 * yD50 + 1.3299098 * zD50

  const linearR = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  const linearG = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
  const linearB = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z

  return [
    clamp(Math.round(linearToSrgb(linearR) * 255), 0, 255),
    clamp(Math.round(linearToSrgb(linearG) * 255), 0, 255),
    clamp(Math.round(linearToSrgb(linearB) * 255), 0, 255),
  ]
}

function parseSrgbColor(value: string): RGB | null {
  const match = /color\(\s*srgb\s+([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const channels = parts.slice(0, 3).map((part) => {
    if (part === "none") {
      return 0
    }
    return part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part)
  })

  if (channels.some((channel) => !Number.isFinite(channel))) {
    return null
  }

  return channels.map((channel) => clamp(Math.round(channel * 255), 0, 255)) as RGB
}

function labPivotInverse(value: number): number {
  const delta = 6 / 29
  return value > delta ? value ** 3 : 3 * delta ** 2 * (value - 4 / 29)
}

function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1)
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
