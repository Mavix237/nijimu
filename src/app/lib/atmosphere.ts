/*
 * The grounds of the whole journey, in order, in one place: paper → the
 * gallery's ground → the pond → under the water → the surface's light →
 * naming. The temperature moves on purpose — off the paper and into the
 * water: warm grey on the landing and in the gallery, a quiet grey-green at
 * the pond, a deeper grey-green under it, near white at the surface — and
 * each step is a small one, so no crossing between them reads as a jump.
 *
 * The panels (landing look, gallery ground, pond) start from these values;
 * what a panel settles on is written back here.
 *
 * Settled 2026-11-01: the pond had gone cool steel-blue (paper #e4e8e9,
 * natural #e2eced, shade #d7e0e8, sky foot #bfc6c8; its near water read
 * #b6c3c7, bluer and darker than both of its neighbours). It now leans
 * grey-green, the way the water under it does, keeping a little of the
 * paper's warmth overhead, and its foot is a shade lighter.
 */

/* ── paper (the landing) ─────────────────────────────────────────────── */
/** The landing's paper, a gradient from top to foot. */
export const PAPER_TOP = "#f4f5f5";
export const PAPER_FOOT = "#ecebeb";
/** The veil over the return to the landing, between the gallery's ground and the paper. */
export const PAPER_RETURN = "#efeeee";

/* ── the gallery's ground (also the shared layout's) ─────────────────── */
export const GROUND = "#edecec";

/* ── the pond (seen from above) ──────────────────────────────────────── */
/** The sky behind the water: overhead, at the horizon band, and low. */
export const POND_SKY_TOP = "#eeefed";
export const POND_SKY_MIDDLE = "#e4e8e6";
export const POND_SKY_FOOT = "#c6cccb";
/** The water's own grey (what `pondAboveColor` keeps as its colour). */
export const POND_WATER = "#e7e8e5";
/** The water's faint natural tint, a multiply: grey-green, not blue. */
export const POND_NATURAL = "#e3eae8";
/** The light on it, warm, and its shade, cool but green-grey rather than blue. */
export const POND_LIGHT_WARM = "#eee9e8";
export const POND_SHADE_COOL = "#dae0e0";
/** The glow over the horizon where the sun's path begins. */
export const POND_GLOW = "#fbf8f3";

/* ── under the water ─────────────────────────────────────────────────── */
/** The water's body seen from inside (≈ #e2e6e5), 0–1 sRGB. */
export const UNDERWATER: readonly [number, number, number] = [0.888, 0.902, 0.897];
/** The same, as a GLSL vec3 literal for the shaders that print it. */
export const UNDERWATER_GLSL = `vec3(${UNDERWATER.map((v) => v.toFixed(3)).join(", ")})`;
/** The wash as the eye sinks under the surface. */
export const SINK_WASH = "#e3eae9";

/* ── the surface, and naming ─────────────────────────────────────────── */
/** The light the rise ends in; naming's ground. */
export const SURFACE_LIGHT = "#f4f6f5";

/** A hex colour as 0–1 sRGB. */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
