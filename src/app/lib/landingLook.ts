import { PAPER_FOOT, PAPER_TOP } from "./atmosphere";

/*
 * The landing's overall look, laid over the whole field (paper, washes,
 * dots, captions): a CSS filter (light, contrast, colour), a tint in a blend
 * mode, and a soft pool of light. Tuned in development by the "landing look"
 * DialKit shell (LandingDials); LANDING_LOOK_DEFAULT is where a settling is
 * written back. Every knob at its neutral value draws nothing at all.
 *
 * During Enter's ink entry the look eases back to neutral with the paper
 * (`mix`), so the gallery's own ground takes over without a jump.
 */

export type LandingLook = {
  /** A CSS filter on the landing's root. */
  filter: { brightness: number; contrast: number; saturate: number; hue: number; sepia: number; blur: number };
  /** A flat colour laid over everything in a blend mode. */
  tint: { color: string; amount: number; blend: string };
  /** A soft pool of light (a radial gradient in a blend mode), and a flat veil of it that lifts the darks. */
  light: { color: string; amount: number; x: number; y: number; size: number; soft: number; blend: string; veil: number };
  /** The bare paper under the washes: a colour, or a gradient from `top` to `bottom` at `angle`. */
  paper: { top: string; bottom: string; angle: number };
  /** The paper's grain: a noise tile per device pixel in a blend mode. */
  grain: { amount: number; blend: string };
  /** The darkened edges: how strong, in what colour, clear out to `inner` of the way. */
  vignette: { amount: number; color: string; inner: number };
  /** The three faint lights that drift under the washes (× as built). */
  ambient: { amount: number };
};

export const LANDING_LOOK_DEFAULT: LandingLook = {
  filter: { brightness: 1.01, contrast: 1, saturate: 1, hue: 0, sepia: 0, blur: 0 },
  tint: { color: "#e9e2dc", amount: 0, blend: "multiply" },
  light: { color: "#ffffff", amount: 0, x: 0.5, y: 0.3, size: 0.8, soft: 0.7, blend: "soft-light", veil: 0 },
  // settled 2026-11-01: a paler paper easing warmer toward the foot (was a flat #e4e4e6),
  // drawn a step toward the gallery's ground (#edecec) so Enter crosses a little, not a lot;
  // the grain as built (overlay at .48), a faint warm-grey vignette (was black .2)
  paper: { top: PAPER_TOP, bottom: PAPER_FOOT, angle: 180 },
  grain: { amount: 0.48, blend: "overlay" },
  vignette: { amount: 0.105, color: "#c4b8b5", inner: 0.22 },
  ambient: { amount: 1 },
};

export const LANDING_BLENDS = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "color", "luminosity", "lighten", "darken"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The filter, `mix` of the way from neutral; undefined when it would do nothing. */
export function landingFilterCss(f: LandingLook["filter"], mix = 1): string | undefined {
  const parts: string[] = [];
  const b = lerp(1, f.brightness, mix), c = lerp(1, f.contrast, mix), s = lerp(1, f.saturate, mix);
  const h = f.hue * mix, sp = f.sepia * mix, bl = f.blur * mix;
  if (Math.abs(b - 1) > 1e-3) parts.push(`brightness(${b.toFixed(3)})`);
  if (Math.abs(c - 1) > 1e-3) parts.push(`contrast(${c.toFixed(3)})`);
  if (Math.abs(s - 1) > 1e-3) parts.push(`saturate(${s.toFixed(3)})`);
  if (sp > 1e-3) parts.push(`sepia(${sp.toFixed(3)})`);
  if (Math.abs(h) > 0.05) parts.push(`hue-rotate(${h.toFixed(1)}deg)`);
  if (bl > 0.02) parts.push(`blur(${bl.toFixed(2)}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** The light pool's gradient: full colour at its centre, gone by `size` (fraction of the screen's diagonal), `soft` of it a fall-off. */
export function landingLightGradient(l: LandingLook["light"]): string {
  const outer = Math.max(1, l.size * 100);
  const inner = outer * (1 - Math.min(1, Math.max(0, l.soft)));
  return `radial-gradient(circle farthest-corner at ${(l.x * 100).toFixed(1)}% ${(l.y * 100).toFixed(1)}%, ${l.color} ${inner.toFixed(1)}%, transparent ${outer.toFixed(1)}%)`;
}

/** The paper's background: one colour, or its gradient. */
export function landingPaperCss(p: LandingLook["paper"]): string {
  return p.top.toLowerCase() === p.bottom.toLowerCase() ? p.top : `linear-gradient(${p.angle}deg, ${p.top}, ${p.bottom})`;
}

/** The vignette's gradient. */
export function landingVignetteCss(v: LandingLook["vignette"]): string {
  const hex = v.color.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16) || 0;
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  return `radial-gradient(ellipse at center, transparent ${(v.inner * 100).toFixed(1)}%, rgba(${rgb},${v.amount.toFixed(3)}) 100%)`;
}
