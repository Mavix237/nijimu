import { oklchToHex, type Oklch } from "./oklch";

/*
 * The landing washes' colours, for the dev colour panel (LandingDials). Each
 * wash wears one of the ten LANDING_TONES slots; the panel can repaint a slot
 * and shift every wash together (hue, chroma, lightness, how much deeper the
 * pigment pools, opacity). With no panel the landing keeps its tones as built.
 */

/** A name per LANDING_TONES slot, in order (MEMORY_COLORS' slots). */
export const WASH_TONE_NAMES = ["slate", "cloud", "mist", "sand", "sky", "rose", "sage", "ocean", "purple", "night"] as const;

/**
 * The landing's wash colours, one per slot (settled in the colour panel,
 * 2026-11-01). They replace the LANDING_TONES the washes used to sample; the
 * pond's pigment drops still draw from LANDING_TONES.
 */
export const WASH_TONE_DEFAULTS: string[] = [
  "#aaabb9", // slate
  "#e5dcdc", // cloud
  "#c1cfd2", // mist
  "#cebbb6", // sand
  "#8cabaf", // sky
  "#b88189", // rose
  "#7493a2", // sage
  "#427587", // ocean
  "#98a5bd", // purple
  "#3f5b6d", // night
];

const WASH_COLOR_ADJUST_DEFAULT_DEEP = 0.07;

/** A slot's colour as built, and its deeper pooled tone, as hex. */
export function washToneHex(slot: number, deepBy = WASH_COLOR_ADJUST_DEFAULT_DEEP): { lit: string; deep: string } {
  const lit = WASH_TONE_DEFAULTS[slot % WASH_TONE_DEFAULTS.length];
  const ok = rgbToOklch(hexToRgb(lit));
  return { lit, deep: oklchToHex({ ...ok, l: Math.max(0.12, ok.l - deepBy) }) };
}

export interface WashColorAdjust {
  /** Degrees round the hue wheel, for every wash. */
  hueShift: number;
  /** × every wash's chroma. */
  chroma: number;
  /** Added to every wash's OKLCH lightness. */
  lightness: number;
  /** How much darker the pooled pigment (deep tone) is than the wash, in OKLCH lightness. */
  deep: number;
  /** × every wash's own opacity. */
  opacity: number;
}

export const WASH_COLOR_ADJUST_DEFAULT: WashColorAdjust = { hueShift: 0, chroma: 1, lightness: 0, deep: 0.07, opacity: 1 };

export interface WashColors {
  /** One CSS colour per slot. */
  tones: string[];
  adjust: WashColorAdjust;
}

/* Any CSS colour (hex, rgb, hsl, oklch…) to 0–1 sRGB, read back through a 1px canvas. */
let probe: CanvasRenderingContext2D | null = null;
export function cssToRgb(css: string): [number, number, number] | null {
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

export function rgbToOklch([r0, g0, b0]: [number, number, number]): Oklch {
  const lin = (n: number) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  const r = lin(r0), g = lin(g0), b = lin(b0);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A slot's pigment and its deeper tone (0–1 rgb) after the panel's colour and adjustments. */
export function washPigment(colors: WashColors, slot: number): { color: [number, number, number]; deep: [number, number, number] } {
  const css = colors.tones[slot] ?? WASH_TONE_DEFAULTS[slot] ?? WASH_TONE_DEFAULTS[0];
  const rgb = cssToRgb(css) ?? hexToRgb(WASH_TONE_DEFAULTS[slot] ?? WASH_TONE_DEFAULTS[0]);
  const a = colors.adjust;
  const base = rgbToOklch(rgb);
  const lit: Oklch = {
    l: Math.min(0.97, Math.max(0.15, base.l + a.lightness)),
    c: Math.max(0, base.c * a.chroma),
    h: (base.h + a.hueShift + 360) % 360,
  };
  const deep: Oklch = { ...lit, l: Math.max(0.12, lit.l - a.deep) };
  return { color: hexToRgb(oklchToHex(lit)), deep: hexToRgb(oklchToHex(deep)) };
}
