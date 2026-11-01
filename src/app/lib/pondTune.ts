import { useSyncExternalStore } from "react";
import * as THREE from "three";

/*
 * The pond's dev knobs (PondDials, DialKit; development only). With the panel
 * unmounted — every production build — `pondTune()` is POND_TUNE_DEFAULT,
 * which is the pond as built, so nothing changes until a knob is moved.
 *
 *   sky      the page behind the water, seen above the horizon (POND_BACKDROP),
 *            and a soft glow on it over the sun's path, so the light in the
 *            water has somewhere to come from
 *   light    how the water's highlights roll off (a shoulder toward `cap`
 *            instead of clipping), the warm light and cool shade laid back
 *            over the paper grey, and how warm the rings' light is
 *   surface  the water seen from above (pondAboveColor / pondSurfaceColor):
 *            its paper grey, how much of its shade it keeps, how clearly the
 *            eye sees down into it, its faint natural tint, the far haze, the
 *            sun's path, ribbons, fibres, reflected clouds, the screen grain
 *   waves    the surface's own motion (POND_WAVES_GLSL): swell, chop, how fine
 *            the wrinkles are, the wind; the held sphere's train; a slow
 *            (pressed) ring's pace; a press's strength
 *   rings    the light on the rings (rippleLight): the crests' glow, the
 *            troughs' shade, the glints along a crest, the bloom under a touch
 *   sphere   the cursor's glowing sphere and its glow
 *   drops    the falling pigment (PondPigmentDrops): angle, size, opacity,
 *            shape, motion blur, how long it is seen sinking
 *   ink      the plume under the water (pondInk): size, hang, life, the depth
 *            where it thins, strength, grain, how clear the water lets it be,
 *            how far the slope bends it, its surface bloom, how it pales with
 *            depth, and its colour against the paint's
 *   tone     the water's stain after each drop: strength, reach up the screen,
 *            the deeper band, when it comes in and how long it crosses over
 *
 * Shader knobs are shared uniform objects (POND_TUNE_UNIFORMS), spread into
 * every pond wave uniform set, so a change reaches the pond and the descent's
 * water at once with nothing written per frame. A material that includes the
 * pond's GLSL without them reads uTuneOn as 0 and keeps the built values.
 */

export interface PondTune {
  sky: {
    top: string; middle: string; bottom: string; middleAt: number;
    glow: string; glowAmount: number; glowX: number; glowY: number; glowWidth: number; glowHeight: number;
  };
  light: { shoulder: number; cap: number; warm: string; warmth: number; cool: string; coolness: number; ringWarm: number };
  surface: {
    paper: string; shade: number; clarity: number; sharpness: number;
    natural: string; naturalAmount: number;
    hazeFrom: number; hazeRate: number;
    sun: number; sunGlow: number; sunSharp: number; pathWidth: number; pathLength: number;
    ribbons: number; fibres: number; clouds: number; grain: number;
  };
  waves: {
    swell: number; chop: number; wrinkle: number; wind: number;
    holdSpeed: number; holdLength: number; holdHeight: number;
    slowPace: number; press: number;
  };
  rings: { glow: number; shade: number; glints: number; bloom: number };
  sphere: { radius: number; sit: number; pressed: number; glow: number; halo: number; reach: number; pressedGlow: number };
  /** `show` off: no drop falls (the prompt's ripple still comes on its own clock).
   *  The drop, its ink and the water's stain are off by default (2026-11-01). */
  drops: { show: boolean; angle: number; radius: number; opacity: number; length: number; shutter: number; sinkS: number };
  /** `show` off: no plume under the water. */
  ink: {
    show: boolean; scale: number; hang: number; lifeS: number; fadeFrom: number; fadeTo: number;
    strength: number; grain: number; grainPx: number; clear: number; bend: number;
    film: number; pale: number; lighter: number; quieter: number;
  };
  /** `show` off: the water keeps its own colour after a drop. */
  tone: { show: boolean; stain: number; reach: number; deepUntil: number; deep: number; delayS: number; crossS: number };
}

/** The pond as settled in the panel (2026-11-01): a softer, wider sun path
 * (was sun 1, glow 1, sharp 220, path 4 × 15; now .7 / 1.63 / 147 / 8 × 28.5),
 * the rings' glow at .76 (was .9), and a cooler grey throughout — the paper
 * #e4e8e9 (was the landing's #e4e4e6), the natural tint #e2eced, the sky
 * #ebeeee → #e1e5e6 → #bfc6c8, warm light #eee9e8 and cool shade #d7e0e8. */
export const POND_TUNE_DEFAULT: PondTune = {
  sky: {
    top: "#ebeeee", middle: "#e1e5e6", bottom: "#bfc6c8", middleAt: .42,
    // a soft light over the horizon where the sun's path begins
    glow: "#fbf8f3", glowAmount: .8, glowX: .5, glowY: .5, glowWidth: .5, glowHeight: .22,
  },
  // highlights ease toward .975 rather than clipping; warm light, cool shade
  light: { shoulder: .85, cap: .975, warm: "#eee9e8", warmth: .55, cool: "#d7e0e8", coolness: .35, ringWarm: .4 },
  surface: {
    paper: "#e4e8e9", shade: .45, clarity: .42, sharpness: 1.25,
    natural: "#e2eced", naturalAmount: 1,
    hazeFrom: 18, hazeRate: .011,
    sun: .7, sunGlow: 1.63, sunSharp: 147, pathWidth: 8, pathLength: 28.5,
    ribbons: .022, fibres: .006, clouds: .06, grain: .017,
  },
  waves: {
    swell: 1, chop: 1, wrinkle: 1, wind: 1,
    holdSpeed: .6, holdLength: .34, holdHeight: .032,
    slowPace: .65, press: .7,
  },
  rings: { glow: .76, shade: .16, glints: .6, bloom: .5 },
  sphere: { radius: .045, sit: .62, pressed: -.4, glow: .3, halo: .12, reach: 6, pressedGlow: .55 },
  drops: { show: false, angle: -18, radius: .085, opacity: .94, length: 2.6, shutter: .025, sinkS: 1.1 },
  ink: {
    show: false, scale: 2.5, hang: 1.6, lifeS: 20, fadeFrom: 1.3, fadeTo: 2.15,
    strength: 1, grain: 2.2, grainPx: .62, clear: .22, bend: 2.2,
    film: 1, pale: .4, lighter: .2, quieter: .7,
  },
  tone: { show: false, stain: .18, reach: .55, deepUntil: .4, deep: .8, delayS: 2.6, crossS: 3 },
};

let current: PondTune = POND_TUNE_DEFAULT;
let version = 0;
const listeners = new Set<() => void>();

export const pondTune = () => current;
export const pondTuneVersion = () => version;

const rgb = (hex: string, out: THREE.Vector3) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0;
  return out.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** One set of uniform objects shared by every pond material (by reference). */
export const POND_TUNE_UNIFORMS = {
  uTuneOn: { value: 1 },
  uTuneWave: { value: new THREE.Vector4() },
  uTuneHold: { value: new THREE.Vector4() },
  uTuneSurf: { value: new THREE.Vector4() },
  uTunePaper: { value: new THREE.Vector3() },
  uTuneNatural: { value: new THREE.Vector3() },
  uTuneHaze: { value: new THREE.Vector4() },
  uTuneSun: { value: new THREE.Vector4() },
  uTuneLight: { value: new THREE.Vector4() },
  uTuneWarm: { value: new THREE.Vector3() },
  uTuneCool: { value: new THREE.Vector3() },
  uTuneTex: { value: new THREE.Vector4() },
  uTuneRing: { value: new THREE.Vector4() },
  uTuneInk: { value: new THREE.Vector4() },
  uTuneInk2: { value: new THREE.Vector4() },
  uTuneInk3: { value: new THREE.Vector4() },
  uTuneTone: { value: new THREE.Vector4() },
};

function writeUniforms(t: PondTune) {
  const u = POND_TUNE_UNIFORMS;
  const { surface: s, waves: w, rings: r, ink: k, tone } = t;
  u.uTuneWave.value.set(w.swell, w.chop, w.wrinkle, w.wind);
  u.uTuneHold.value.set(w.holdSpeed, w.holdLength, w.holdHeight, w.slowPace);
  u.uTuneSurf.value.set(s.shade, s.clarity, s.sharpness, s.naturalAmount);
  rgb(s.paper, u.uTunePaper.value);
  rgb(s.natural, u.uTuneNatural.value);
  u.uTuneHaze.value.set(s.hazeFrom, s.hazeRate, s.sun, s.sunGlow);
  u.uTuneSun.value.set(Math.max(2, s.sunSharp), Math.max(.2, s.pathWidth), Math.max(1, s.pathLength), t.light.ringWarm);
  u.uTuneLight.value.set(t.light.shoulder, t.light.cap, t.light.warmth, t.light.coolness);
  rgb(t.light.warm, u.uTuneWarm.value);
  rgb(t.light.cool, u.uTuneCool.value);
  u.uTuneTex.value.set(s.ribbons, s.fibres, s.clouds, s.grain);
  u.uTuneRing.value.set(r.glow, r.shade, r.glints, r.bloom);
  u.uTuneInk.value.set(k.scale, k.hang, k.lifeS, k.show ? k.strength : 0);
  u.uTuneInk2.value.set(k.fadeFrom, Math.max(k.fadeFrom + .01, k.fadeTo), k.grain, Math.max(.05, k.grainPx));
  u.uTuneInk3.value.set(k.clear, k.bend, k.film, k.pale);
  u.uTuneTone.value.set(tone.show ? tone.stain : 0, Math.max(.01, tone.reach), Math.max(.01, tone.deepUntil), tone.deep);
}
writeUniforms(current);

export function setPondTune(next: PondTune) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  version++;
  writeUniforms(next);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Re-renders when the panel changes anything; returns the tune. */
export function usePondTune() {
  return useSyncExternalStore(subscribe, pondTune, pondTune);
}

/** The page behind the pond: its sky gradient, and the glow over the sun's path. */
export const pondBackdropCss = (s: PondTune["sky"] = current.sky) => {
  const sky = `linear-gradient(${s.top}, ${s.middle} ${(s.middleAt * 100).toFixed(1)}%, ${s.bottom})`;
  if (s.glowAmount <= 0) return sky;
  const c = rgb(s.glow, new THREE.Vector3()).multiplyScalar(255);
  const at = (a: number) => `rgba(${c.x.toFixed(0)},${c.y.toFixed(0)},${c.z.toFixed(0)},${a.toFixed(3)})`;
  const a = Math.min(1, s.glowAmount);
  // a long soft fall-off, no edge to it
  const glow = `radial-gradient(ellipse ${(s.glowWidth * 100).toFixed(1)}% ${(s.glowHeight * 100).toFixed(1)}% at ${(s.glowX * 100).toFixed(1)}% ${(s.glowY * 100).toFixed(1)}%, `
    + `${at(a)} 0%, ${at(a * .62)} 28%, ${at(a * .28)} 56%, ${at(a * .08)} 80%, ${at(0)} 100%)`;
  return `${glow}, ${sky}`;
};

/**
 * Declared once at the head of POND_WAVES_GLSL. TUNE(built, knob) is the
 * knob where the material carries POND_TUNE_UNIFORMS (uTuneOn 1) and the
 * built value where it does not (an unset uniform reads 0).
 */
/** A default colour as a GLSL vec3, for the fallbacks below. */
const vec3Of = (hex: string) => {
  const c = rgb(hex, new THREE.Vector3());
  return `vec3(${c.x.toFixed(4)}, ${c.y.toFixed(4)}, ${c.z.toFixed(4)})`;
};
const DS = POND_TUNE_DEFAULT.surface, DL = POND_TUNE_DEFAULT.light;

export const POND_TUNE_GLSL = /* glsl */ `
  uniform float uTuneOn;
  uniform vec4 uTuneWave;
  uniform vec4 uTuneHold;
  uniform vec4 uTuneSurf;
  uniform vec3 uTunePaper;
  uniform vec3 uTuneNatural;
  uniform vec4 uTuneHaze;
  uniform vec4 uTuneSun;
  uniform vec4 uTuneLight;
  uniform vec3 uTuneWarm;
  uniform vec3 uTuneCool;
  uniform vec4 uTuneTex;
  uniform vec4 uTuneRing;
  uniform vec4 uTuneInk;
  uniform vec4 uTuneInk2;
  uniform vec4 uTuneInk3;
  uniform vec4 uTuneTone;
  #define TUNE(b, k) mix(b, k, uTuneOn)
  #define T_SWELL TUNE(1.0, uTuneWave.x)
  #define T_CHOP TUNE(1.0, uTuneWave.y)
  #define T_WRINKLE TUNE(1.0, uTuneWave.z)
  #define T_WIND TUNE(1.0, uTuneWave.w)
  #define T_HOLD_SPEED TUNE(${POND_TUNE_DEFAULT.waves.holdSpeed.toFixed(3)}, uTuneHold.x)
  #define T_HOLD_LENGTH TUNE(${POND_TUNE_DEFAULT.waves.holdLength.toFixed(3)}, uTuneHold.y)
  #define T_HOLD_HEIGHT TUNE(${POND_TUNE_DEFAULT.waves.holdHeight.toFixed(3)}, uTuneHold.z)
  #define T_SLOW_PACE TUNE(${POND_TUNE_DEFAULT.waves.slowPace.toFixed(3)}, uTuneHold.w)
  #define T_SHADE TUNE(.45, uTuneSurf.x)
  #define T_CLARITY TUNE(.42, uTuneSurf.y)
  #define T_SHARP TUNE(1.25, uTuneSurf.z)
  #define T_NATURAL_AMOUNT TUNE(1.0, uTuneSurf.w)
  #define T_PAPER TUNE(${vec3Of(DS.paper)}, uTunePaper)
  #define T_NATURAL TUNE(${vec3Of(DS.natural)}, uTuneNatural)
  #define T_HAZE_FROM TUNE(18.0, uTuneHaze.x)
  #define T_HAZE_RATE TUNE(.011, uTuneHaze.y)
  #define T_SUN TUNE(${DS.sun.toFixed(3)}, uTuneHaze.z)
  #define T_SUN_GLOW TUNE(${DS.sunGlow.toFixed(3)}, uTuneHaze.w)
  #define T_SUN_SHARP TUNE(147.0, uTuneSun.x)
  #define T_PATH_WIDTH TUNE(8.0, uTuneSun.y)
  #define T_PATH_LENGTH TUNE(28.5, uTuneSun.z)
  #define T_RING_WARM TUNE(.4, uTuneSun.w)
  #define T_SHOULDER TUNE(.85, uTuneLight.x)
  #define T_LIGHT_CAP TUNE(.975, uTuneLight.y)
  #define T_WARMTH TUNE(.55, uTuneLight.z)
  #define T_COOLNESS TUNE(.35, uTuneLight.w)
  #define T_WARM TUNE(${vec3Of(DL.warm)}, uTuneWarm)
  #define T_COOL TUNE(${vec3Of(DL.cool)}, uTuneCool)
  #define T_RIBBONS TUNE(.022, uTuneTex.x)
  #define T_FIBRES TUNE(.006, uTuneTex.y)
  #define T_CLOUDS TUNE(.06, uTuneTex.z)
  #define T_GRAIN TUNE(.017, uTuneTex.w)
  #define T_RING_GLOW TUNE(.76, uTuneRing.x)
  #define T_RING_SHADE TUNE(.16, uTuneRing.y)
  #define T_GLINTS TUNE(.6, uTuneRing.z)
  #define T_BLOOM TUNE(.5, uTuneRing.w)
  #define T_INK_SCALE TUNE(2.5, uTuneInk.x)
  #define T_INK_HANG TUNE(1.6, uTuneInk.y)
  #define T_INK_LIFE TUNE(20.0, uTuneInk.z)
  #define T_INK_STRENGTH TUNE(1.0, uTuneInk.w)
  #define T_INK_FADE_FROM TUNE(1.3, uTuneInk2.x)
  #define T_INK_FADE_TO TUNE(2.15, uTuneInk2.y)
  #define T_INK_GRAIN TUNE(2.2, uTuneInk2.z)
  #define T_INK_GRAIN_PX TUNE(.62, uTuneInk2.w)
  #define T_INK_CLEAR TUNE(.22, uTuneInk3.x)
  #define T_INK_BEND TUNE(2.2, uTuneInk3.y)
  #define T_INK_FILM TUNE(1.0, uTuneInk3.z)
  #define T_INK_PALE TUNE(.4, uTuneInk3.w)
  #define T_TONE_STAIN TUNE(.18, uTuneTone.x)
  #define T_TONE_REACH TUNE(.55, uTuneTone.y)
  #define T_TONE_DEEP_UNTIL TUNE(.4, uTuneTone.z)
  #define T_TONE_DEEP TUNE(.8, uTuneTone.w)
`;
