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
export const POND_SKY_TOP = "#eeefef"; // was #eeefed (2026-11-01)
export const POND_SKY_MIDDLE = "#e4e8e6";
export const POND_SKY_FOOT = "#c6cccb";
/** The water's own grey (what `pondAboveColor` keeps as its colour). */
export const POND_WATER = "#e6e8e8"; // was #e7e8e5 (2026-11-01)
/** The water's faint natural tint, a multiply: a cool blue-grey toward the foot. */
export const POND_NATURAL = "#d2d9dd"; // was #e3eae8 (2026-11-01): a deeper, cooler foot
/** The light on it, warm, and its shade, cool but green-grey rather than blue. */
export const POND_LIGHT_WARM = "#eee8e6"; // was #eee9e8 (2026-11-01)
export const POND_SHADE_COOL = "#d5dadd"; // was #dae0e0 (2026-11-01)
/** The glow over the horizon where the sun's path begins. */
export const POND_GLOW = "#fbf8f3";

/* ── under the water ─────────────────────────────────────────────────── */
/** The water's body seen from inside (≈ #e1e6e8), 0–1 sRGB. Leaned cooler
 * 2026-11-01 toward the pond's new water (paper #e6e8e8, natural #d2d9dd),
 * at the same luma, so the pond above — which keeps only this colour's
 * lightness — is unchanged (was [.888, .902, .897], ≈ #e2e6e5, grey-green). */
export const UNDERWATER: readonly [number, number, number] = [0.884, 0.901, 0.911];
/** The same, as a GLSL vec3 literal for the shaders that print it. */
export const UNDERWATER_GLSL = `vec3(${UNDERWATER.map((v) => v.toFixed(3)).join(", ")})`;
/** The wash as the eye sinks under the surface. */
export const SINK_WASH = "#e4e9ec"; // was #e3eae9 (2026-11-01): cooler, same luma, with UNDERWATER

/* ── the surface, and naming ─────────────────────────────────────────── */
/** The light the rise ends in; naming's ground. */
export const SURFACE_LIGHT = "#f4f6f5";

/** The sink wash as a GLSL vec3 literal (the ascent's last handoff on the glass). */
export const SINK_WASH_GLSL = `vec3(${hexRgb(SINK_WASH).map((v) => v.toFixed(4)).join(", ")})`;

/** A hex colour as 0–1 sRGB. */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
