import * as THREE from "three";
import { LANDING_TONES, landingTone } from "./homePaletteField";
import { oklchToHex, type Oklch } from "./oklch";
import { POND_DROP_SLOTS } from "./voicePeaks";

/*
 * The pond's pigment. Each prompt's ripple is made by a drop of the landing's
 * paint falling from above the frame; where it lands it rings the water and
 * sinks into it as ink — a bloom near the surface, a curling head going down,
 * tendrils hanging from it — seen through the moving surface, so the waves
 * bend it. The rings themselves glow, white, broken into glints along their
 * crests. Everything here is a pure function of the pond's clock and the
 * prompt cue, so nothing is stored.
 */

/** Seconds from a drop entering the frame to its touching the water. */
export const POND_DROP_FALL_S = 1.5;
/** How long a drop's ink is seen in the water. Less than three prompt periods,
 * so a spot's ink has gone before the next drop lands there. */
export const POND_INK_LIFE_S = 20;
/** Ink slots, taken in turn: more than the drops that can still be seen at
 * once, so a quick return to the pond never takes the place of visible ink. */
export const POND_INK_SLOTS = 4;
/** How large the ink opens, world units per unit of its model. The pond is
 * seen from far off and low over it; at life size the plume is a smudge. */
export const POND_INK_SCALE = 2.5;
/** How much deeper on screen the ink is let hang than it truly would (seen
 * this low over the water a true depth all but vanishes), for a plume
 * `POND_INK_HANG_NEAR` from the eye. A farther one hangs longer still, by
 * (distance / near)^1.3 up to 1.8×: the same depth looks shorter the farther
 * off it is, and this lets every plume go about as far down the screen as the
 * nearest does, ending near its foot. */
export const POND_INK_HANG = 1.6;
export const POND_INK_HANG_NEAR = 14;
const HANG_GROW = 1.3, HANG_MAX = 1.8;
/** The hang for a plume this far (across the water) from the eye. */
export const inkHang = (distance: number) =>
  POND_INK_HANG * Math.min(HANG_MAX, Math.max(1, Math.pow(distance / POND_INK_HANG_NEAR, HANG_GROW)));
/** The ink's head under the surface (model units) and how wide it has
 * opened, by seconds since the drop went in: the drop plunges on its own way
 * at first and is checked within a breath, then the ink sinks on its weight;
 * it opens from the drop's own size. The shader and the sinking drop share
 * these, so the drop goes down to just where the ink's head is. */
const HEAD = { start: .05, plunge: .2, plungeS: .3, settle: .62, settleS: 3.6, sink: .068 } as const;
const SPREAD = { start: .04, bloom: .08, bloomS: .7, open: .62, openS: 7 } as const;
export const inkHead = (age: number) => HEAD.start + HEAD.plunge * (1 - Math.exp(-age / HEAD.plungeS))
  + HEAD.settle * (1 - Math.exp(-age / HEAD.settleS)) + HEAD.sink * age;
export const inkSpread = (age: number) => SPREAD.start + SPREAD.bloom * (1 - Math.exp(-age / SPREAD.bloomS))
  + SPREAD.open * (1 - Math.exp(-age / SPREAD.openS));
/** Added to a ripple's strength to mark it slow (POND_WAVES_GLSL's uDrops):
 * a press on the water. */
export const POND_SLOW_DROP = 10;
/** A slow ripple's clock against the pond's: a little under two-thirds pace. */
export const POND_SLOW_PACE = .65;
/** The held sphere's continuous waves (POND_WAVES_GLSL's holdWave): how fast
 * they spread (world units/s, about a slow press ring's), how far apart the
 * crests are, and how high they stand. */
export const HOLD_WAVE_SPEED = .6;
export const HOLD_WAVE_LENGTH = .34;
export const HOLD_WAVE_HEIGHT = .032;
/** The ink's grain: the landing washes' paper tooth (washTune's grain), its
 * strength and its size in drawing-buffer pixels (a little finer than the
 * washes' .8). */
export const POND_INK_GRAIN = 2.2;
export const POND_INK_GRAIN_PX = .62;
/** Seconds the drop is still seen after it goes in, sinking to the ink's head
 * and dissolving into it as the ink comes up around it. */
export const POND_DROP_SINK_S = 1.1;
/** Teardrop's radius at its round foot, world units, as seen where it lands. */
export const POND_DROP_RADIUS = .085;
/** The way the drops come in: degrees clockwise from the top of the screen
 * to where they come from. −18 (18° anticlockwise) brings them down from
 * above, leaning in a little from the left. */
export const POND_DROP_ANGLE_DEG = -18;
/** Depth below the surface (ink model units) where the ink begins to thin
 * away, and where it is gone. */
export const POND_INK_FADE = [1.3, 2.15] as const;
/** The water's tint after each drop, laid as the vessels' stain is
 * (VesselPreview's feelingTint) but up the screen and with no band: strongest
 * at the foot of the screen in the drop's deeper tone, easing into the tone
 * itself and thinning smoothly to clear a little over half-way up. How strong
 * it is at the foot. */
export const POND_TONE_STAIN = .18;

/** The landing's tones the drops carry, deep ones only: cloud (mist's pale
 * top) would vanish against the water. Display (sRGB) values, as the pond's
 * shaders write their colours. */
const display = (ok: Oklch) => {
  const hex = oklchToHex(ok);
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16) / 255;
  return new THREE.Vector3(channel(1), channel(3), channel(5));
};
const DEEP_TONES = LANDING_TONES.filter(tone => tone.v > 0).map(landingTone);
export const POND_PIGMENTS: THREE.Vector3[] = DEEP_TONES.map(display);
/** Each pigment's deeper tone, as the vessels' foot band takes it: a tenth
 * darker and a quarter richer. */
export const POND_PIGMENT_DEEPS: THREE.Vector3[] = DEEP_TONES
  .map(ok => display({ ...ok, l: Math.max(0, ok.l - .1), c: ok.c * 1.25 }));

/** Which pigment a prompt cycle carries: a fixed walk through the tones from a
 * place chosen once per visit, so neighbouring drops are never the same. */
const pigmentIndex = (cycle: number, offset: number) =>
  ((cycle * 5 + offset) % POND_PIGMENTS.length + POND_PIGMENTS.length) % POND_PIGMENTS.length;
export const pigmentFor = (cycle: number, offset: number) => POND_PIGMENTS[pigmentIndex(cycle, offset)];
export const pigmentDeepFor = (cycle: number, offset: number) => POND_PIGMENT_DEEPS[pigmentIndex(cycle, offset)];
/** Each pigment as its ink, thinned in the water: well lighter and quieter
 * than the paint the drop carried. */
export const POND_PIGMENT_LIGHTS: THREE.Vector3[] = DEEP_TONES
  .map(ok => display({ ...ok, l: Math.min(.95, ok.l + .2), c: ok.c * .7 }));
export const pigmentLightFor = (cycle: number, offset: number) => POND_PIGMENT_LIGHTS[pigmentIndex(cycle, offset)];

/** How far (screen px) a drop still has to travel `untilImpact` seconds from
 * landing, given how far off it enters. It keeps one speed all the way. */
export function dropTravel(untilImpact: number, entry: number) {
  return entry * Math.max(0, Math.min(1, untilImpact / POND_DROP_FALL_S));
}
/** Its speed, px per second. */
export const dropSpeed = (entry: number) => entry / POND_DROP_FALL_S;

/** Seconds after a drop lands before the water begins to take its tint (the
 * ink has had time to spread), and how long it takes to cross over to it. */
export const POND_TONE_DELAY_S = 2.6;
export const POND_TONE_CROSSFADE_S = 3;
/** How far the water has crossed from the tint it wore to a drop's, by the
 * time since that drop landed. The tint holds until the next one has landed
 * and spread, so one colour gives way to the next and they never pile up. */
export function pondToneCrossfade(age: number) {
  const t = Math.max(0, Math.min(1, (age - POND_TONE_DELAY_S) / POND_TONE_CROSSFADE_S));
  return t * t * (3 - 2 * t);
}

export interface PondPigmentUniforms extends Record<string, THREE.IUniform> {
  uInk: { value: THREE.Vector4[] };
  uInkTint: { value: THREE.Vector4[] };
  uPondLife: { value: number };
  uPondTone: { value: THREE.Vector4 };
  uPondToneDeep: { value: THREE.Vector4 };
  uHold: { value: THREE.Vector4 };
}
export const createPondPigmentUniforms = (): PondPigmentUniforms => ({
  // x, z, time it landed, strength
  uInk: { value: Array.from({ length: POND_INK_SLOTS }, () => new THREE.Vector4(0, 0, -99, 0)) },
  // linear rgb, seed
  uInkTint: { value: Array.from({ length: POND_INK_SLOTS }, () => new THREE.Vector4(.3, .35, .45, 0)) },
  // 1 while the pond's invitation owns the water; 0 leaves every other shot as it was
  uPondLife: { value: 0 },
  // the latest drop's colour and how far the water has turned toward it
  uPondTone: { value: new THREE.Vector4(1, 1, 1, 0) },
  // the deeper tone of the foot band, and the drawing buffer's height in px
  uPondToneDeep: { value: new THREE.Vector4(1, 1, 1, 1) },
  // the held sphere's wave source (POND_WAVES_GLSL's holdWave); still until held
  uHold: { value: new THREE.Vector4(0, 0, 0, 0) },
});

/** Needs POND_WAVES_GLSL (hash, noise, breath, uDrops, uTime) above it. */
export const POND_PIGMENT_GLSL = /* glsl */ `
  uniform vec4 uInk[${POND_INK_SLOTS}];
  uniform vec4 uInkTint[${POND_INK_SLOTS}];
  uniform float uPondLife;
  uniform vec4 uPondTone;
  uniform vec4 uPondToneDeep;
  float inkHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(inkHash(i), inkHash(i + vec3(1,0,0)), f.x), mix(inkHash(i + vec3(0,1,0)), inkHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(inkHash(i + vec3(0,0,1)), inkHash(i + vec3(1,0,1)), f.x), mix(inkHash(i + vec3(0,1,1)), inkHash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  // How deep the ink's leading head has gone: the drop's own way carries it
  // down at first, then it slows and sinks on its weight.
  // Once in the water it goes slowly: most of the drop's way is spent in the
  // first few seconds, then it sinks on its weight.
  float inkHead(float age) {
    return ${HEAD.start} + ${HEAD.plunge} * (1.0 - exp(-age / ${HEAD.plungeS})) + ${HEAD.settle} * (1.0 - exp(-age / ${HEAD.settleS}))
      + ${HEAD.sink} * age;
  }
  // How wide it has opened: from the drop's own size.
  float inkSpread(float age) {
    return ${SPREAD.start} + ${SPREAD.bloom} * (1.0 - exp(-age / ${SPREAD.bloomS})) + ${SPREAD.open} * (1.0 - exp(-age / ${SPREAD.openS}.0));
  }
  // One upright slice through the ink, \`across\` from its axis toward the eye
  // (q.x across, q.y depth below the surface, model units). A head that rolls
  // into two curls as it sinks, the thin column it pulls down behind it and
  // tendrils hanging from it, all carried by one slow flow and drawn into
  // threads by a ridged noise, as ink in still water is. Two strands of
  // threads, each drifted its own way by the flow, so within one plume the
  // trace folds over itself; the pond multiplies them, and where they cross
  // the ink is deeper.
  // \`soften\` (0–1) is how far it has blurred into the water: its shapes
  // widen, keeping their weight, and its threads lose their contrast.
  // \`stretch\` is how much longer than the nearest this plume is let hang:
  // its threads are drawn that much finer down the slice, so the longer hang
  // shows more of them instead of the same ones smeared.
  vec2 inkSlice(vec2 q, float across, float age, float seed, float soften, float stretch) {
    float wb = 1.0 + 1.6 * soften;
    float head = inkHead(age);
    float spread = inkSpread(age);
    float grown = min(1.0, age / 5.5);
    vec2 w = q * 2.1 + vec2(seed + across * 3.0, -age * .09);
    vec2 warp = vec2(noise(w), noise(w + 7.3)) - .5;
    warp += (vec2(noise(w * 2.4 + 3.1), noise(w * 2.4 + 9.4)) - .5) * .5;
    vec2 r = q + warp * (.14 + .3 * grown) * (spread + .3);
    // the head's two curls: the water turns round each side of it
    for (int side = 0; side < 2; side++) {
      float sgn = side == 0 ? -1.0 : 1.0;
      vec2 core = vec2(sgn * spread * .72, head);
      vec2 v = r - core;
      float reach = spread * .5 + .05;
      float turn = sgn * 2.6 * exp(-dot(v, v) / (reach * reach)) * min(1.0, age / 2.6);
      float c = cos(turn), s = sin(turn);
      r = core + vec2(c * v.x - s * v.y, s * v.x + c * v.y);
    }
    float rho = length(vec2(r.x, across));
    float body = exp(-pow((rho - spread * .62) / ((spread * .3 + .03) * wb), 2.0)) * exp(-pow((r.y - head) / ((spread * .38 + .04) * wb), 2.0));
    body += exp(-rho * rho / ((spread * spread * .25 + .002) * wb * wb)) * exp(-pow((r.y - head) / ((spread * .3 + .03) * wb), 2.0)) * .5;
    float along = clamp(r.y / max(head, .01), 0.0, 1.0);
    float column = exp(-rho * rho / ((.006 + spread * spread * .07 * along) * wb * wb)) * (.35 + .65 * along) * (1.0 - smoothstep(head - .05 * wb, head + .1 * wb, r.y)) * .7;
    float lobes = pow(.5 + .5 * cos(r.x / max(spread, .05) * 4.2 + seed * 3.0 + across * 5.0), 3.0);
    float below = max(0.0, r.y - head);
    float hang = spread * (.35 + 1.15 * lobes) * (.3 + .7 * grown);
    float tendril = lobes * exp(-pow((rho - spread * .55) / ((spread * .35 + .03) * wb), 2.0))
      * exp(-below / max(hang, .02)) * smoothstep(head - .1, head + .05, r.y) * .8;
    // threads: the noise's own contours, drawn out down the slice more than
    // across it and bent by the same flow, so they curl where the head does
    // spread wider, the same ink is thinner
    float shape = (body + column + tendril) / wb;
    vec2 rs = vec2(r.x, r.y * stretch);
    float ridge = 1.0 - abs(noise(rs * vec2(3.2, 1.4) + seed * 3.1 + across * 7.0) * 2.0 - 1.0);
    float fine = 1.0 - abs(noise(rs * vec2(7.5, 3.2) - seed + across * 3.0) * 2.0 - 1.0);
    float thread = mix(.1, 1.0, pow(ridge, 4.0)) + pow(fine, 6.0) * .4;
    // the second strand: the same ink carried a little apart and turned, so
    // its threads run across the first one's
    vec2 drift = (vec2(noise(w * 1.3 + 17.0), noise(w * 1.3 + 23.0)) - .5) * (.3 + .4 * grown) * (spread + .2);
    vec2 r2 = rs + drift;
    float ridge2 = 1.0 - abs(noise(vec2(r2.x * 1.6 + r2.y * 2.4, r2.y * 1.9 - r2.x * .9) + seed * 5.3 + across * 4.0 + 31.0) * 2.0 - 1.0);
    float thread2 = mix(.04, 1.0, pow(ridge2, 5.0));
    // blurred, the threads run together into an even haze
    thread = mix(thread, .5, soften * .85);
    thread2 = mix(thread2, .4, soften * .85);
    return shape * vec2(thread, thread2 * .85);
  }
  // The ink's colour as a multiply layer: deeper, more water lies over it
  // and it pales toward clear.
  vec3 inkDepthTone(vec3 tint, float depth) {
    return mix(tint, vec3(1.0), (1.0 - exp(-depth * .5)) * .4);
  }
  vec3 pondInk(vec2 p, vec3 n, vec3 eye, vec3 color) {
    if (uPondLife < .001) return color;
    // Down through the surface as it is drawn, so each wave bends what is under it.
    vec3 ray = refract(-eye, n, 1.0 / 1.333);
    vec2 lateral = ray.xz / max(.3, -ray.y);
    float away = min(-.05, lateral.y);
    // How much of the body the surface lets through, against what it mirrors:
    // the water is let be clearer than its own shading over the ink, so the
    // trace can be followed down into it.
    float fresnel = pow(1.0 - max(0.0, dot(n, eye)), 3.0);
    float clear = 1.0 - fresnel * .22;
    // The surface's slope also bends what is under it, more the deeper it lies.
    vec2 bend = n.xz * 2.2;
    const float SCALE = ${POND_INK_SCALE.toFixed(2)};
    // Seen this low over the water a true depth all but vanishes; the ink is
    // let hang deeper on screen than it would, so it reads falling, and the
    // farther plumes longer (inkHang); it thins away by POND_INK_FADE, so
    // that never carries it past the foot of the screen.
    const int SLICES = 5;
    // The paper's tooth, as the landing's washes have it (WatercolorField's
    // look): value noise laid in screen pixels at ${POND_INK_GRAIN_PX} px, three
    // octaves turned against each other, lifting and thinning the paint's cover.
    vec2 gp = gl_FragCoord.xy / ${POND_INK_GRAIN_PX.toFixed(2)};
    float tooth = noise(gp) * .45 + noise(mat2(.8, -.6, .6, .8) * gp * .43 + 7.7) * .35
      + noise(mat2(.28, -.96, .96, .28) * gp * .16 + 3.1) * .2;
    float grain = 1.0 + .28 * ${POND_INK_GRAIN.toFixed(2)} * (tooth - .5);
    for (int i = 0; i < ${POND_INK_SLOTS}; i++) {
      float strength = uInk[i].w;
      float age = uTime - uInk[i].z;
      if (strength < .001 || age < 0.0 || age > ${POND_INK_LIFE_S.toFixed(1)}) continue;
      float spread = inkSpread(age);
      float stretch = clamp(pow(length(cameraPosition.xz - uInk[i].xy) / ${POND_INK_HANG_NEAR.toFixed(1)}, ${HANG_GROW}), 1.0, ${HANG_MAX});
      float HANG = ${POND_INK_HANG.toFixed(2)} * stretch;
      vec2 o = (p - uInk[i].xy) / SCALE;
      // (generous: the flow's curls and the late blur's widening reach well
      // past the plume's spread, and a bound any nearer cut its edges straight)
      if (abs(o.x) > spread * 3.8 + 1.0 || o.y < -.9 || o.y > ${POND_INK_FADE[1].toFixed(2)} * -away * HANG + 1.0) continue;
      // it comes up round the drop as the drop dissolves into it
      float life = smoothstep(.05, ${(POND_DROP_SINK_S * .75).toFixed(2)}, age) * (1.0 - smoothstep(${(POND_INK_LIFE_S * .45).toFixed(1)}, ${POND_INK_LIFE_S.toFixed(1)}, age))
        / (1.0 + age * .07);
      vec3 tint = uInkTint[i].rgb;
      float seed = uInkTint[i].w;
      // only late in its life, as it fades, does it blur into the water
      float fading = smoothstep(${(POND_INK_LIFE_S * .5).toFixed(1)}, ${(POND_INK_LIFE_S * .92).toFixed(1)}, age);
      float late = smoothstep(${(POND_INK_LIFE_S * .4).toFixed(1)}, ${(POND_INK_LIFE_S * .65).toFixed(1)}, age);
      // the pigment that stays on the surface and opens there
      vec2 fw = o * 2.4 + seed + bend * .15;
      vec2 fo = o + (vec2(noise(fw), noise(fw + 4.1)) - .5) * (spread + .2) * .8;
      float film = exp(-dot(fo, fo) / (spread * spread * 1.2 + .01)) * (.35 + .65 * noise(fo * 7.0 + seed));
      // Every strand of every slice, and every plume, is laid over the water
      // as multiply: overlaps go deeper and mix, as layered washes do.
      vec3 layer = vec3(1.0);
      for (int k = 0; k < SLICES; k++) {
        float across = (2.0 - float(k)) * .18;
        float run = o.y - across;
        if (run < 0.0) continue;
        float depth = run / (-away * HANG);
        if (depth > ${POND_INK_FADE[1].toFixed(2)} + .1) continue;
        vec2 q = vec2(o.x + lateral.x * run / -away, depth) + bend * (.25 + depth) / SCALE;
        // past a certain depth it has thinned into the water
        float reach = 1.0 - smoothstep(${POND_INK_FADE[0].toFixed(2)}, ${POND_INK_FADE[1].toFixed(2)}, depth);
        // and, by then, where it has gone down to where it thins away
        float soften = max(fading, smoothstep(${(POND_INK_FADE[0] - .15).toFixed(2)}, ${POND_INK_FADE[1].toFixed(2)}, depth) * late);
        vec2 a = 1.0 - exp(-inkSlice(q, across, age, seed, soften, stretch) * life * strength * reach * 2.6);
        a = clamp(a * grain, 0.0, 1.0);
        vec3 tone = inkDepthTone(tint, depth);
        layer *= mix(vec3(1.0), tone, a.x) * mix(vec3(1.0), tone, a.y);
      }
      float a = clamp((1.0 - exp(-film * life * strength * .9)) * grain, 0.0, 1.0);
      layer *= mix(vec3(1.0), tint, a);
      color *= mix(vec3(1.0), layer, clear);
    }
    return color;
  }
  // The rings' own light: white, gathered on each crest and broken into
  // glints along it, brightest while a ring is young and near where it began.
  // Follows rippleField's front (see there) without its wobble detail.
  vec2 rippleLight(vec2 p) {
    vec2 light = vec2(0.0);
    vec2 wob = breath(p);
    for (int i = 0; i < ${POND_DROP_SLOTS}; i++) {
      float mag = abs(uDrops[i].w);
      float slow = step(${POND_SLOW_DROP.toFixed(1)}, mag);
      float strength = min(mag - slow * ${POND_SLOW_DROP.toFixed(1)}, 1.5);
      float soft = uDrops[i].w < 0.0 ? 1.0 : 0.0;
      if (strength < .001 || uTime < uDrops[i].z) continue;
      // on the same clock as the train itself (rippleField)
      float age = (uTime - uDrops[i].z) * mix(1.0, ${POND_SLOW_PACE}, slow);
      if (age > 7.0) continue;
      vec2 delta = p - uDrops[i].xy;
      float rd = length(delta);
      delta += wob * min(.07, .012 + rd * .022);
      float d = length(delta);
      float ang = atan(delta.y, delta.x);
      float seed = hash(uDrops[i].xy) * 6.2831853;
      float quickRadius = age * 1.02 + .42 * (1.0 - exp(-age * 6.5));
      float gentleRadius = 1.02 * (age - .35 * (1.0 - exp(-age / .35)));
      float radius = mix(quickRadius, gentleRadius, soft);
      float front = d - radius;
      float trail = max(0.0, -front);
      float wavelength = (.30 + age * .10) * (.9 + .2 * hash(uDrops[i].xy + 3.7));
      float wave = cos(trail / wavelength * 6.2831853);
      float decay = exp(-trail * 3.6 / (1.0 + age * .55));
      float crest = pow(max(0.0, wave), 3.0) * decay;
      // the water between the crests a shade darker, so the light has something to rise against
      float trough = pow(max(0.0, -wave), 1.5) * decay;
      float gate = exp(-pow(max(0.0, front) / (.05 + age * .015), 2.0));
      // light gathered unevenly along the ring: broad, soft swells round it,
      // never broken into chips
      float glints = noise(vec2(ang * (2.0 + d * .6) + seed, trail * 1.6 - age * .5 + seed));
      glints = smoothstep(.15, .9, glints);
      // a soft light under the touch, there at once and soon spent
      float bloom = exp(-d * d / .09) * exp(-age * 2.6);
      float life = smoothstep(0.0, mix(.03, .6, soft), age) * exp(-age * .55) / (1.0 + d * .7);
      float weight = life * strength * mix(1.0, .45, soft);
      light.x += (crest * gate * (.45 + .6 * glints) + bloom * .5) * weight;
      light.y += trough * gate * weight;
    }
    // the held sphere's train, lit the same way
    vec2 heldDir;
    vec2 held = holdWave(p, heldDir);
    light.x += pow(max(0.0, held.x), 3.0) * held.y * .5;
    light.y += pow(max(0.0, -held.x), 1.5) * held.y * .6;
    return light;
  }
  // The pond's pigment and the rings' light, over the surface's own colour.
  vec3 pondPigment(vec2 p, vec3 n, vec3 eye, vec3 color) {
    if (uPondLife < .001) return color;
    // the whole water turned a little toward the latest drop, its lightness kept
    // The latest drop's stain, rising from the foot of the screen as the
    // vessels' does from theirs: a filter over the water (its pale ground reads
    // as the tone), clear from half-way up.
    if (uPondTone.w > .001) {
      const float GROUND = .87;
      float up = clamp(gl_FragCoord.y / max(1.0, uPondToneDeep.w), 0.0, 1.0);
      // one gradient, no edge in it: full at the foot, gone by 55% of the height
      float rise = 1.0 - smoothstep(0.0, .55, up);
      // the deeper tone low down, giving way to the tone itself as it rises
      vec3 tone = mix(uPondTone.rgb, uPondToneDeep.rgb, (1.0 - smoothstep(0.0, .4, up)) * .8);
      float k = uPondTone.w * uPondLife;
      color *= mix(vec3(1.0), min(tone / GROUND, vec3(1.1)), rise * ${POND_TONE_STAIN.toFixed(2)} * k);
    }
    color = pondInk(p, n, eye, color);
    vec2 light = rippleLight(p);
    color *= 1.0 - (1.0 - exp(-light.y * 2.0)) * .16 * uPondLife;
    float glow = 1.0 - exp(-light.x * 3.2);
    return mix(color, vec3(1.0), glow * .9 * uPondLife);
  }
`;

/** The falling drop, drawn flat on the screen as the landing's cutouts are:
 * a slim teardrop of the paint's own colour, no light on it, its edge
 * softened and wandering a little, the point trailing back the way it came,
 * and smeared back along that way by its speed (uBlur, in foot radii: the
 * places it passed through while the eye's "shutter" was open, averaged).
 * Drawn on a quad placed in screen pixels: the foot is at uCenter, the point
 * toward uDir, uSize the scale of its outline (the foot itself is narrower). */
export const POND_DROP_VERTEX = /* glsl */ `
  uniform vec2 uCenter;
  uniform vec2 uViewport;
  uniform vec2 uDir;
  uniform float uSize;
  uniform float uLength;
  uniform float uBlur;
  uniform float uSoft;
  varying vec2 vLocal;
  void main() {
    // the quad covers the foot, the point uLength behind it and the smear
    // (plus room for the soft edge)
    float pad = uSoft / uSize;
    vLocal = vec2(position.x * (.9 + pad), mix(-1.0 - pad, uLength + uBlur + .4 + pad, position.y * .5 + .5));
    vec2 side = vec2(-uDir.y, uDir.x);
    vec2 px = uCenter + (side * vLocal.x + uDir * vLocal.y) * uSize;
    gl_Position = vec4(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0, 0.0, 1.0);
  }
`;
export const POND_DROP_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uSize;
  uniform float uLength;
  uniform float uBlur;
  uniform float uSoft;
  uniform float uSeed;
  varying vec2 vLocal;
  // a narrow foot drawn straight to a fine point (after Inigo Quilez's uneven capsule)
  float teardrop(vec2 p, float r1, float r2, float h) {
    p.x = abs(p.x);
    float b = (r1 - r2) / h;
    float a = sqrt(1.0 - b * b);
    float k = dot(p, vec2(-b, a));
    if (k < 0.0) return length(p) - r1;
    if (k > a * h) return length(p - vec2(0.0, h)) - r2;
    return dot(p, vec2(a, b)) - r1;
  }
  float cover(vec2 p) {
    float ang = atan(p.y, p.x);
    float wander = (sin(ang * 3.0 + uSeed) * .5 + sin(ang * 5.0 - uSeed * 1.7) * .3) * .025;
    // the foot a little longer than it is wide, so it is less round
    float d = (teardrop(vec2(p.x, p.y * .8), .52, .03, uLength * .8) + wander) * uSize;
    // out of focus as it falls: the edge spread over uSoft px either side
    return 1.0 - smoothstep(-uSoft, uSoft, d);
  }
  void main() {
    // Where it was over the last instant, back along its way.
    const int TAPS = 12;
    float alpha = 0.0;
    for (int i = 0; i < TAPS; i++) {
      float t = (float(i) + .5) / float(TAPS);
      alpha += cover(vLocal - vec2(0.0, t * uBlur)) * (1.25 - t * .5);
    }
    alpha /= float(TAPS);
    // the smear thins the paint, not the drop out of sight: a soft gain keeps
    // its body nearly whole and lets the tail fade
    alpha = (1.0 - exp(-alpha * 2.6)) / (1.0 - exp(-2.6));
    gl_FragColor = vec4(uTint, min(1.0, alpha) * uOpacity);
  }
`;
