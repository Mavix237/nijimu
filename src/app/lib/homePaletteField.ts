import { COLOR_PALETTE } from "./colors";
import type { Oklch } from "./oklch";

/** Horizontal colour regions in the original continuous water field. */
export const HOME_FIELD_STOPS = ["rose", "sand", "mist", "sky", "sage", "ocean", "slate", "purple", "night"] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function labFromHex(hex: string) {
  const linear = (offset: number) => {
    const n = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  };
  const r = linear(1), g = linear(3), b = linear(5);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return { l: .2104542553 * l + .793617785 * m - .0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    b: .0259040371 * l + .7827717662 * m - .808675766 * s };
}
const stops = HOME_FIELD_STOPS.map(id => {
  // The landing's slate is its grey-violet ink. Give that same hue a richer
  // purple region; keep these picker adjustments out of the shared home palette.
  const entry = COLOR_PALETTE.find(entry => entry.id === (id === "purple" ? "slate" : id))!;
  const base = labFromHex(entry.color);
  const strength = id === "purple" ? 3.6 : 1.65;
  const bottom = { l: Math.max(.25, base.l - .045), a: base.a * strength, b: base.b * strength };
  // Lift the top without replacing its hue with the nearly-grey light colours.
  const top = { l: Math.min(.9, bottom.l + .15), a: bottom.a * .72, b: bottom.b * .72 };
  return { top, bottom };
});
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Same two-dimensional field: colour across, light to deep down. Blend strengthened homescreen
 * palette tones in OKLab instead of travelling around a full hue wheel. */
export function sampleHomePalette(u: number, v: number): Oklch {
  const x = clamp(u) * (stops.length - 1), y = clamp(v);
  const index = Math.min(stops.length - 2, Math.floor(x));
  const t = x - index, from = stops[index], to = stops[index + 1];
  const channel = (key: "l" | "a" | "b") => mix(mix(from.top[key], to.top[key], t), mix(from.bottom[key], to.bottom[key], t), y);
  const l = channel("l"), a = channel("a"), b = channel("b");
  return { l, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
}

/** Place a carried colour at its closest point without changing the saved tint. */
export function uvFromHomePalette(color: Oklch) {
  const a = color.c * Math.cos(color.h * Math.PI / 180), b = color.c * Math.sin(color.h * Math.PI / 180);
  let best = { u: .5, v: .5 }, distance = Infinity;
  for (let row = 0; row <= 64; row++) {
    for (let step = 0; step <= 256; step++) {
      const u = step / 256, v = row / 64, candidate = sampleHomePalette(u, v);
      const d = (candidate.l - color.l) ** 2 + (candidate.c * Math.cos(candidate.h * Math.PI / 180) - a) ** 2
        + (candidate.c * Math.sin(candidate.h * Math.PI / 180) - b) ** 2;
      if (d < distance) { best = { u, v }; distance = d; }
    }
  }
  return best;
}
