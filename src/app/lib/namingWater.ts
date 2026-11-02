import * as THREE from "three";
import { POND_NATURAL, hexRgb } from "./atmosphere";
import { oklchToRgb, rgbToOklch, type Oklch } from "./oklch";
import type { NamingLakeTune } from "./namingTune";
import type { PondSurfaceShare } from "../lab/VesselArtifact";

/*
 * Naming's lake takes a little of the memory's colour round the vessel's
 * reflection (2026-11-01). One set of uniform objects, spread into the naming
 * pond's water material (PerspectivePond's own uniforms) and written by
 * PondNamingOverlay: where the reflection lies on the screen, and the colour.
 * The tint only turns the hue of the water (the filter is evened to its own
 * luma), so the lake keeps its lightness and its light; a colour near the
 * water's own blue gives nothing, since the water already wears it.
 * Unmounted (or amount 0) the water is exactly as before.
 */
export const NAMING_WATER_UNIFORMS = {
  /** rgb: the tint (0–1 sRGB); w: how much of it at the centre (0 none). */
  uNameTint: { value: new THREE.Vector4(1, 1, 1, 0) },
  /** xy: the centre, as a share of the drawing buffer (0,0 bottom left); zw: its radii, as a share of the height. */
  uNameTintAt: { value: new THREE.Vector4(.5, .3, .4, .15) },
  /** x: falloff; y: the faint wash over the whole lake (share of w); zw: the drawing buffer, px. */
  uNameTintShape: { value: new THREE.Vector4(1.4, 0, 1, 1) },
  /** The landing spot: rgb its colour (the vessel's foot tone, 0–1 sRGB); w how deep (0 none). */
  uNameSpot: { value: new THREE.Vector4(1, 1, 1, 0) },
  /** xy its radii (share of the height); z falloff; w how much the waves move it. */
  uNameSpotShape: { value: new THREE.Vector4(.1, .03, 1.5, .02) },
};

/** Declared in the naming pond's fragment shader, applied after its colour. */
export const NAMING_WATER_GLSL = /* glsl */ `
  uniform vec4 uNameTint;
  uniform vec4 uNameTintAt;
  uniform vec4 uNameTintShape;
  uniform vec4 uNameSpot;
  uniform vec4 uNameSpotShape;
  // n: the water's normal there, so the spot and the ring lie on the moving surface
  vec3 namingLake(vec3 color, vec3 n) {
    if (uNameTint.w <= .0005 && uNameSpot.w <= .0005) return color;
    vec2 res = max(uNameTintShape.zw, vec2(1.0));
    vec2 q = gl_FragCoord.xy / res - uNameTintAt.xy;
    q.x *= res.x / res.y;
    q += n.xz * uNameSpotShape.w;
    const vec3 LUMA = vec3(.299, .587, .114);
    // the ring: the memory's hue spread round the landing, the water's lightness kept
    if (uNameTint.w > .0005) {
      float r = length(q / max(uNameTintAt.zw, vec2(.001)));
      float near = pow(1.0 - smoothstep(0.0, 1.0, r), uNameTintShape.x);
      float w = uNameTint.w * max(near, uNameTintShape.y * (1.0 - smoothstep(0.0, 3.0, r)));
      vec3 filt = uNameTint.rgb / max(.01, dot(uNameTint.rgb, LUMA));
      color = mix(color, color * filt, w);
    }
    // the landing spot: the foot's own tone, laid into the water as a dye (multiply) where the reflection falls
    if (uNameSpot.w > .0005) {
      float rs = length(q / max(uNameSpotShape.xy, vec2(.001)));
      float spot = pow(1.0 - smoothstep(0.0, 1.0, rs), uNameSpotShape.z);
      vec3 dye = clamp(uNameSpot.rgb / .92, 0.0, 1.0);
      color = mix(color, color * dye, spot * uNameSpot.w);
    }
    return color;
  }
`;

const WATER_HUE = (() => { const [r, g, b] = hexRgb(POND_NATURAL); return rgbToOklch(r, g, b).h; })();
const hueGap = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a))); return t * t * (3 - 2 * t); };

/**
 * How much the memory's colour reaches the lake (0…1): none for a pale grey
 * pick or one near the water's own hue, all of it once it is a clear step
 * away (`guard` degrees, eased over `guardSoft`).
 */
export function lakeWeight(pick: Oklch | null, t: NamingLakeTune): number {
  if (!pick) return 0;
  return smoothstep(t.minChroma, t.minChroma + .015, pick.c) * smoothstep(t.guard, t.guard + t.guardSoft, hueGap(pick.h, WATER_HUE));
}

/** The tint for a pick: its hue at the water's lightness, its chroma boosted (the filter is evened to luma). */
export function writeLakeColor(pick: Oklch | null, t: NamingLakeTune) {
  const u = NAMING_WATER_UNIFORMS;
  u.uNameTintShape.value.x = Math.max(.1, t.falloff);
  u.uNameTintShape.value.y = Math.max(0, t.wash);
  u.uNameSpotShape.value.set(Math.max(.001, t.spotRadiusX), Math.max(.001, t.spotRadiusY), Math.max(.1, t.spotFalloff), t.spotRipple);
  // the spot wears the foot's deep tone (the glass's foot band: l −.1, chroma ×1.25); with no colour, the water's shade
  const foot = pick ? oklchToRgb({ l: pick.l - .1, c: pick.c * 1.25, h: pick.h }) : hexRgb(POND_NATURAL);
  u.uNameSpot.value.set(foot[0], foot[1], foot[2], Math.max(0, t.spot));
  const weight = lakeWeight(pick, t);
  if (!pick || weight <= 0 || t.amount <= 0) { u.uNameTint.value.w = 0; return; }
  const [r, g, b] = oklchToRgb({ l: .82, c: Math.min(.14, pick.c * t.boost), h: pick.h });
  u.uNameTint.value.set(r, g, b, t.amount * weight);
}

/**
 * Where the reflection lands: the contact point the vessel reports (client px),
 * or the seat's foot until it has; sizes are in seat sizes.
 */
export function writeLakePlace(seat: DOMRect, contact: { x: number; y: number } | null, viewW: number, viewH: number, t: NamingLakeTune) {
  const u = NAMING_WATER_UNIFORMS.uNameTintAt.value;
  const cx = contact?.x ?? seat.left + seat.width / 2;
  const cy = (contact?.y ?? seat.bottom) + seat.height * t.offsetY;
  const h = Math.max(1, viewH);
  u.set(cx / Math.max(1, viewW), 1 - cy / h, (seat.width * t.radiusX) / h, (seat.height * t.radiusY) / h);
  // the spot's radii were written in seat sizes: to the screen's height
  const spot = NAMING_WATER_UNIFORMS.uNameSpotShape.value;
  spot.x = (seat.width * Math.max(.001, t.spotRadiusX)) / h;
  spot.y = (seat.height * Math.max(.001, t.spotRadiusY)) / h;
}

/** Both fade with the vessel's presence (appearing, rising, going back under). */
export function fadeLake(here: number) {
  NAMING_WATER_UNIFORMS.uNameTint.value.w *= here;
  NAMING_WATER_UNIFORMS.uNameSpot.value.w *= here;
}

export function clearLake() {
  NAMING_WATER_UNIFORMS.uNameTint.value.w = 0;
  NAMING_WATER_UNIFORMS.uNameSpot.value.w = 0;
}

/* The naming pond lends its surface to the vessel's reflection: its GLSL
   (waves + surface), its uniform objects (by reference: the same clock, rings
   and knobs), its camera and its canvas. Set while naming's own pond is
   mounted; the reflection falls back to none without it. */
let share: PondSurfaceShare | null = null;
const shareListeners = new Set<() => void>();
export function lendPondSurface(next: PondSurfaceShare | null) {
  share = next;
  shareListeners.forEach((l) => l());
}
export const pondSurfaceShare = () => share;
export function onPondSurface(l: () => void) {
  shareListeners.add(l);
  return () => { shareListeners.delete(l); };
}
