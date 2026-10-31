import { useEffect, useRef } from "react";
import type { WashTune } from "../lib/washTune";

/*
 * The landing's washes, painted as one field rather than one layer per blob:
 * every blob adds pigment to the same wet paper, so where two meet their
 * colours run into each other and share one edge. Each blob has a character
 * between a complete wash (a fringed tide line where the pigment dried) and
 * a free, diffuse one (soft, streaked, no line at all), and its shape keeps
 * slowly changing. Positions come from the blob elements themselves, so the
 * captions, drift and pan stay exactly as they were.
 *
 * With WebGL2 the pigment is a fluid: the washes are painted into a low
 * resolution dye that a stable-fluids velocity field carries, so the pointer
 * pushes paint (it banks up ahead of the stroke, thins behind it, curls off
 * in eddies) and the dye relaxes back toward the washes' own shapes. Without
 * float render targets the washes are painted directly and do not stir.
 */

export interface WashBlob {
  /** Pigment and its deeper tone, 0–1 rgb. */
  color: [number, number, number];
  deep: [number, number, number];
  /** 1 a complete wash with a drying edge, 0 a free, diffuse one. */
  comp: number;
  seed: number;
  opacity: number;
}

const MAX = 24;
const FRAME_MS = 1000 / 30;
/** While the paint is moving it is painted at full rate. */
const STIR_FRAME_MS = 1000 / 60;
/** After the last stroke the flow is let go, once it has had this many lifetimes to die down. */
const SETTLE_LIVES = 4;
/** While the washes open, stirred paint returns this quickly (s), so it keeps up with the growth. */
const GROW_RELAX_S = 0.3;
const SEGS = 8;
/** The tide line follows its caption a little behind, so it deepens and settles like water. */
const TIDE_EASE_MS = 450;
/** A round wash grows from nothing (this share of its size) as it arrives, so the paper opens clear. */
const OPEN_REACH = 0;
/*
 * The washes arrive one after another: one or two in view first, then the
 * rest at a quickening pace, the last beginning at `lastStart`. Each fades in
 * over `fadeMs` and grows over `growMs`, so the round ones are whole by ~7 s
 * and the free ones by ~8.5 s.
 */
const REVEAL = { second: 650, restFrom: 1500, lastStart: 3800, jitter: 200, growMs: 3300, fadeMs: 2000 };
/**
 * A free, streaked wash does not zoom open as a round one does: it starts most
 * of its size and comes up through its ink, more slowly.
 */
const FREE_REVEAL = { reachFrom: 0.72, growLonger: 0.35, fadeLonger: 0.9 };
const revealSpan = REVEAL.lastStart + REVEAL.jitter + REVEAL.growMs * (1 + FREE_REVEAL.growLonger);
/** 1 for a free, elongated wash, 0 for a complete round one. */
const freeness = (comp: number) => {
  const x = Math.min(1, Math.max(0, (0.75 - comp) / 0.4));
  return x * x * (3 - 2 * x);
};

function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** When each wash begins (ms from the field's first frame), from where they lie on screen. */
function revealOrder(rects: (DOMRect | null)[]) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const inView = (r: DOMRect | null) => {
    if (!r) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return x > vw * 0.12 && x < vw * 0.88 && y > vh * 0.12 && y < vh * 0.88;
  };
  const idx = rects.map((_, i) => i);
  const seen = shuffle(idx.filter((i) => inView(rects[i])));
  const firsts = seen.slice(0, Math.random() < 0.5 ? 1 : 2);
  // what is in view tends to come before what is off it
  const rest = idx
    .filter((i) => !firsts.includes(i))
    .map((i) => ({ i, at: Math.random() + (inView(rects[i]) ? 0 : 0.35) }))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.i);
  const starts = new Array<number>(rects.length).fill(0);
  firsts.forEach((i, k) => { starts[i] = k * REVEAL.second; });
  rest.forEach((i, k) => {
    const f = rest.length > 1 ? k / (rest.length - 1) : 0;
    const jitter = (Math.random() - 0.5) * 2 * REVEAL.jitter;
    const from = firsts.length ? REVEAL.restFrom : 0;
    starts[i] = Math.max(0, from + (REVEAL.lastStart - from) * f ** 0.8 + jitter);
  });
  return starts;
}
/** Eased in and out (smootherstep: still at both ends) and never past 1, so the growth only ever widens. */
const openEase = (k: number) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const DECL = `
#define MAX ${MAX}
uniform vec2 uRes;
uniform float uTime;
`;

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; }
  return s;
}
`;

/* The washes at p (container px): their joined density, character and pigment. */
const WASH = `
uniform int uCount;
uniform vec4 uBlob[MAX];
uniform vec4 uLook[MAX];
uniform vec4 uDeep[MAX];
/** How much of each wash's ink has come through: free washes arrive by this rather than by size. */
uniform float uShow[MAX];
/** Each wash's own tide line: deeper while its memory's words are on show. */
uniform float uTide[MAX];
uniform float uJoin, uWarp, uMorph;
bool wash(vec2 p, out float D, out float comp, out vec3 pig, out vec3 pigDeep, out float vis, out float tide) {
  D = 0.; comp = 0.; pig = vec3(0.); pigDeep = vec3(0.); vis = 0.; tide = 0.;
  float sumW = 0., compW = 0., cw = 0., visW = 0., tideW = 0.;
  vec3 col = vec3(0.), deep = vec3(0.);
  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;
    vec4 b = uBlob[i];
    vec4 l = uLook[i];
    vec2 d = (p - b.xy) / b.z;
    if (dot(d, d) > 2.8) continue;
    float bc = l.a, s = b.w;
    float t = uTime * uMorph * (.03 + .025 * fract(s * 7.13));
    // the body turns and stretches slowly, so no wash keeps one outline
    float ang = s * 6.283 + t * .5;
    vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
    q.x *= 1. + (.18 + .3 * (1. - bc)) * sin(t * .8 + s * 3.1);
    q.y *= 1. + .14 * sin(t * .6 + s * 5.7);
    vec2 w = vec2(fbm(q * 1.25 + vec2(s * 13.1, t)), fbm(q * 1.25 + vec2(t, s * 29.7) + 5.2)) - .5;
    // free washes are carried along in streaks, as ink on wet paper
    float streak = (fbm(q * vec2(.6, 2.8) + vec2(t * .8, s * 3.3)) - .5) * (1. - bc) * 1.3 * uWarp;
    float dist = length(q + w * mix(.85, .24, bc) * uWarp + vec2(streak, streak * .25));
    // uDeep.a carries the blob's own opacity
    float dens = pow(smoothstep(1.05, 0., dist), mix(1.7, 1., bc)) * mix(.58, 1.05, bc) * uDeep[i].a;
    // a p-norm, not a sum: washes join where both are wet, not through their faint tails
    D += pow(dens, uJoin);
    sumW += dens;
    compW += bc * dens;
    visW += uShow[i] * dens;
    tideW += uTide[i] * dens;
    float w2 = dens * dens;
    cw += w2;
    col += l.rgb * w2;
    deep += uDeep[i].rgb * w2;
  }
  if (sumW < .003) return false;
  D = pow(D, 1. / uJoin);
  comp = compW / sumW;
  vis = visW / sumW;
  tide = tideW / sumW;
  pig = col / max(cw, 1e-5);
  pigDeep = deep / max(cw, 1e-5);
  return true;
}
`;

/* Pigment on paper: one wet edge for the whole field, premultiplied. */
const LOOK = `
uniform float uField, uThresh, uFringe, uSoft, uGrain, uDeepMix, uSat;
/** Canvas pixels per screen pixel, and the grain's size in screen pixels. */
uniform float uPxScale, uGrainPx;
vec4 look(vec2 p, float D, float comp, vec3 pig, vec3 pigDeep, float vis, float tide) {
  // where washes join, so do their edges; finely fringed, as pigment creeps into the fibres
  // each octave turned, so no layer of the fringe lines up with the pixel grid
  vec2 pr1 = mat2(.8, -.6, .6, .8) * p;
  vec2 pr2 = mat2(.28, -.96, .96, .28) * p;
  vec2 fib = gl_FragCoord.xy / uPxScale;
  float jag = fbm(p * .025) * .42 + fbm(pr1 * .09) * .27 + noise(pr2 * .42) * .16
    + noise(mat2(-.6, -.8, .8, -.6) * fib * .9) * .1 + noise(fib * 2.1 + 3.3) * .05;
  float T = uThresh + (jag - .5) * mix(.22, .16, comp) * uFringe;
  float soft = mix(.26, .05, comp) * uSoft;
  float body = smoothstep(T - soft, T + soft * .6, D);
  float interior = 1. - exp(-D * 1.4);
  float bloom = fbm(p * .004 + vec2(uTime * .006, uTime * .002));
  float cover = body * (.3 + .7 * interior) * (.76 + .48 * bloom);
  // pigment carried to the drying edge of a complete wash
  float edge = clamp(exp(-pow((D - T) / (mix(.12, .035, comp) * uSoft), 2.)) * comp * body * tide, 0., 1.);
  // the paper's tooth is laid in screen pixels, so it stays fine at any density
  vec2 px = gl_FragCoord.xy / (uPxScale * uGrainPx);
  float tooth = noise(px) * .45 + noise(mat2(.8, -.6, .6, .8) * px * .43 + 7.7) * .35 + noise(pr2 * .37) * .2;
  cover *= 1. + .28 * uGrain * (tooth - .5);
  vec3 c = mix(pig, pigDeep, clamp(interior * uDeepMix + edge * .7, 0., 1.));
  c *= 1. - edge * .16;
  // saturation about the pigment's own luma, so the washes keep their weight on the paper
  c = clamp(mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uSat), 0., 1.);
  float a = clamp(cover * uField + edge * .16, 0., .92) * vis;
  return vec4(c * a, a);
}
`;

const VERT1 = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }
`;

const FRAG1 = `
precision highp float;
varying vec2 vUv;
${DECL}${NOISE}${WASH}${LOOK}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uRes;
  float D, comp, vis, tide; vec3 pig, deep;
  if (!wash(p, D, comp, pig, deep, vis, tide)) { gl_FragColor = vec4(0.); return; }
  gl_FragColor = look(p, D, comp, pig, deep, vis, tide);
}
`;

const VERT3 = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }
`;

const H3 = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
`;

/* Neighbours on the velocity grid. */
const NB = `
uniform vec2 uTexel;
vec2 nL() { return vUv - vec2(uTexel.x, 0.); }
vec2 nR() { return vUv + vec2(uTexel.x, 0.); }
vec2 nB() { return vUv - vec2(0., uTexel.y); }
vec2 nT() { return vUv + vec2(0., uTexel.y); }
`;

/** The washes as they would lie undisturbed: (pigment·D, D), (deep·D, character·D) and (shown·D, tide·D). */
const TARGET3 = `${H3}${DECL}${NOISE}${WASH}
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uRes;
  float D, comp, vis, tide; vec3 pig, deep;
  if (!wash(p, D, comp, pig, deep, vis, tide)) { o0 = vec4(0.); o1 = vec4(0.); o2 = vec4(0.); return; }
  o0 = vec4(pig * D, D);
  o1 = vec4(deep * D, comp * D);
  o2 = vec4(vis * D, tide * D, 0., 0.);
}
`;

/** The brush: velocity near each stroke segment is drawn toward the stroke's own. */
const SPLAT3 = `${H3}
#define SEGS ${SEGS}
uniform sampler2D uVel;
uniform vec2 uRes;
uniform vec4 uSeg[SEGS];
uniform vec2 uSegVel[SEGS];
uniform int uSegs;
uniform float uRadius, uGrip;
out vec4 o;
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uRes;
  vec2 v = texture(uVel, vUv).xy;
  for (int k = 0; k < SEGS; k++) {
    if (k >= uSegs) break;
    vec2 a = uSeg[k].xy, ab = uSeg[k].zw - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0., 1.);
    vec2 d = p - (a + ab * t);
    float g = exp(-dot(d, d) / (uRadius * uRadius));
    v = mix(v, uSegVel[k], g * uGrip);
  }
  o = vec4(v, 0., 1.);
}
`;

const ADVECT_VEL3 = `${H3}
uniform sampler2D uVel;
uniform vec2 uTexel;
uniform float uDt, uDecay;
out vec4 o;
void main() {
  vec2 back = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  o = vec4(texture(uVel, back).xy * uDecay, 0., 1.);
}
`;

const CURL3 = `${H3}${NB}
uniform sampler2D uVel;
out vec4 o;
void main() {
  float L = texture(uVel, nL()).y, R = texture(uVel, nR()).y;
  float B = texture(uVel, nB()).x, T = texture(uVel, nT()).x;
  o = vec4(.5 * (R - L - T + B), 0., 0., 1.);
}
`;

const VORT3 = `${H3}${NB}
uniform sampler2D uVel, uCurl;
uniform float uDt, uStrength;
out vec4 o;
void main() {
  float L = texture(uCurl, nL()).x, R = texture(uCurl, nR()).x;
  float B = texture(uCurl, nB()).x, T = texture(uCurl, nT()).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uStrength * C;
  f.y *= -1.;
  o = vec4(texture(uVel, vUv).xy + f * uDt, 0., 1.);
}
`;

const DIV3 = `${H3}${NB}
uniform sampler2D uVel;
out vec4 o;
void main() {
  vec2 C = texture(uVel, vUv).xy;
  float L = texture(uVel, nL()).x, R = texture(uVel, nR()).x;
  float B = texture(uVel, nB()).y, T = texture(uVel, nT()).y;
  // the paper's edge is a wall
  if (nL().x < 0.) L = -C.x;
  if (nR().x > 1.) R = -C.x;
  if (nB().y < 0.) B = -C.y;
  if (nT().y > 1.) T = -C.y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
}
`;

const PRESSURE3 = `${H3}${NB}
uniform sampler2D uP, uDiv;
out vec4 o;
void main() {
  float L = texture(uP, nL()).x, R = texture(uP, nR()).x;
  float B = texture(uP, nB()).x, T = texture(uP, nT()).x;
  o = vec4((L + R + B + T - texture(uDiv, vUv).x) * .25, 0., 0., 1.);
}
`;

const GRAD3 = `${H3}${NB}
uniform sampler2D uP, uVel;
out vec4 o;
void main() {
  float L = texture(uP, nL()).x, R = texture(uP, nR()).x;
  float B = texture(uP, nB()).x, T = texture(uP, nT()).x;
  o = vec4(texture(uVel, vUv).xy - .5 * vec2(R - L, T - B), 0., 1.);
}
`;

/**
 * The dye is carried by the flow and drawn back toward the undisturbed washes.
 * A stroke brings clear water with it: under the brush the paint thins, in
 * uneven streaks and more for a quick stroke, and the flow then carries that
 * paper on into the washes.
 */
const DYE3 = `${H3}${NOISE}
#define SEGS ${SEGS}
uniform sampler2D uA, uB, uC, uTA, uTB, uTC, uVel;
uniform vec2 uVelTexel, uRes;
uniform float uDt, uRelax;
uniform vec4 uSeg[SEGS];
uniform float uSegSpeed[SEGS];
uniform int uSegs;
uniform float uRadius, uWipe;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  vec2 back = vUv - uDt * texture(uVel, vUv).xy * uVelTexel;
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uRes;
  float keep = 1.;
  for (int k = 0; k < SEGS; k++) {
    if (k >= uSegs) break;
    vec2 a = uSeg[k].xy, ab = uSeg[k].zw - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0., 1.);
    vec2 d = p - (a + ab * t);
    float r = uRadius * 1.3;
    float g = exp(-dot(d, d) / (r * r));
    // streaks run along the stroke: noise across it, stretched along it
    vec2 dir = ab / max(length(ab), 1e-3);
    vec2 q = vec2(dot(p, dir) * .01, dot(p, vec2(-dir.y, dir.x)) * .035);
    float streak = smoothstep(.3, .75, fbm(q + float(k) * 3.1));
    float pace = smoothstep(60., 900., uSegSpeed[k]);
    keep *= 1. - clamp(uWipe * g * pace * (.35 + .65 * streak), 0., 1.);
  }
  o0 = mix(texture(uA, back) * keep, texture(uTA, vUv), uRelax);
  o1 = mix(texture(uB, back) * keep, texture(uTB, vUv), uRelax);
  o2 = mix(texture(uC, back) * keep, texture(uTC, vUv), uRelax);
}
`;

const COMPOSITE3 = `${H3}${DECL}${NOISE}${LOOK}
uniform sampler2D uA, uB, uC, uTA, uTC;
uniform float uEdge;
out vec4 o;
void main() {
  vec4 A = texture(uA, vUv), B = texture(uB, vUv);
  float D = A.a;
  if (D < .004) { o = vec4(0.); return; }
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uRes;
  // the tide follows the words at once, from the washes as they lie, not as the flow has carried them
  float TD = texture(uTA, vUv).a;
  float tide = TD > .004 ? texture(uTC, vUv).g / TD : uEdge;
  // the tide line belongs to a wash's own rim: where the undisturbed paint is
  // well inside a wash, paint thinned by a stroke shows paper, not a dark line
  tide *= 1. - smoothstep(uThresh + .12, uThresh + .32, TD);
  o = look(p, D, clamp(B.a / D, 0., 1.), A.rgb / D, B.rgb / D, clamp(texture(uC, vUv).r / D, 0., 1.), tide);
}
`;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

function compile(gl: GL, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function link(gl: GL, vert: string, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    return null;
  }
  const locs = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name));
    return locs.get(name)!;
  };
  return { prog, u };
}
type Program = NonNullable<ReturnType<typeof link>>;

interface Target { fb: WebGLFramebuffer; tex: WebGLTexture[]; w: number; h: number }

function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, count: number): Target | null {
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const tex: WebGLTexture[] = [];
  for (let i = 0; i < count; i++) {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    tex.push(t);
  }
  gl.drawBuffers(tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteFramebuffer(fb);
    tex.forEach((t) => gl.deleteTexture(t));
    return null;
  }
  return { fb, tex, w, h };
}

function dropTarget(gl: WebGL2RenderingContext, t: Target | null) {
  if (!t) return;
  gl.deleteFramebuffer(t.fb);
  t.tex.forEach((x) => gl.deleteTexture(x));
}

/** Grid size with the paper's aspect, `long` cells on its long side. */
function gridFor(w: number, h: number, long: number) {
  return w >= h
    ? { w: long, h: Math.max(8, Math.round((long * h) / w)) }
    : { w: Math.max(8, Math.round((long * w) / h)), h: long };
}

interface Stroke { x0: number; y0: number; x1: number; y1: number; vx: number; vy: number }

export function WatercolorField({
  width,
  height,
  blobs,
  blobEls,
  containerRef,
  tune,
  resolution,
  presenceRef,
  wordsRef,
  onReady,
}: {
  width: number;
  height: number;
  blobs: WashBlob[];
  blobEls: React.MutableRefObject<(HTMLDivElement | null)[]>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Read every frame, so the panel's knobs move the field live. */
  tune: WashTune;
  /** Device pixels per CSS pixel the field is painted at; the washes are soft. */
  resolution: number;
  /** Written every frame: how far each wash has arrived, 0…1, for the marks that sit on it. */
  presenceRef?: React.MutableRefObject<number[]>;
  /** Read every frame: how present each wash's caption is, 0…1; its tide line deepens with it. */
  wordsRef?: React.MutableRefObject<number[]>;
  /** Whether the field could be painted; without it the blob elements stay visible. */
  onReady: (ok: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef(blobs);
  blobsRef.current = blobs;
  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const attrs: WebGLContextAttributes = { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false };
    const gl2 = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    const fluid = !!gl2 && !!gl2.getExtension("EXT_color_buffer_float");
    const gl: GL | null = gl2 ?? (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);
    if (!gl) { readyRef.current(false); return; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    const blobData = new Float32Array(MAX * 4);
    const lookData = new Float32Array(MAX * 4);
    const deepData = new Float32Array(MAX * 4);
    const uShow = new Float32Array(MAX).fill(1);
    const uTide = new Float32Array(MAX).fill(tuneRef.current.edge);
    const lift = new Float32Array(MAX);
    let liftAt = -1;
    let openedAt = -1;
    let startsAt: number[] = [];
    const opening = (now: number) => {
      if (openedAt < 0) openedAt = now;
      return now - openedAt;
    };
    const readBlobs = (now: number) => {
      const ct = containerRef.current;
      if (!ct) return -1;
      const cr = ct.getBoundingClientRect();
      const list = blobsRef.current;
      const n = Math.min(MAX, list.length);
      const full = tuneRef.current.reach;
      const since = opening(now);
      const rects: (DOMRect | null)[] = [];
      for (let i = 0; i < n; i++) rects.push(blobEls.current[i]?.getBoundingClientRect() ?? null);
      if (startsAt.length !== n) startsAt = revealOrder(rects);
      const shown = presenceRef?.current;
      const words = wordsRef?.current;
      const { edge, edgeShown } = tuneRef.current;
      const ease = liftAt < 0 ? 1 : 1 - Math.exp(-(now - liftAt) / TIDE_EASE_MS);
      liftAt = now;
      for (let i = 0; i < n; i++) {
        lift[i] += ((words?.[i] ?? 0) - lift[i]) * ease;
        uTide[i] = edge + (edgeShown - edge) * lift[i];
        const el = blobEls.current[i];
        const r = rects[i];
        const b = list[i];
        const f = freeness(b.comp);
        const t = since - startsAt[i];
        const fadeMs = REVEAL.fadeMs * (1 + FREE_REVEAL.fadeLonger * f);
        const grown = openEase(t / (REVEAL.growMs * (1 + FREE_REVEAL.growLonger * f)));
        const inked = openEase(t / fadeMs);
        // a round wash's density rises with its fade; a free one's is set early and its ink does the arriving
        const body = inked + (openEase(t / (fadeMs * 0.45)) - inked) * f;
        const show = 1 + (inked - 1) * f;
        if (shown) shown[i] = inked;
        uShow[i] = show;
        if (!el || !r || inked <= 0) { blobData[i * 4 + 2] = 0.0001; deepData[i * 4 + 3] = 0; continue; }
        const from = OPEN_REACH + (FREE_REVEAL.reachFrom - OPEN_REACH) * f;
        const reach = (from + (1 - from) * grown) * full;
        const s = parseFloat(getComputedStyle(el).scale) || 1;
        const radius = (el.offsetWidth / 2) * s * reach;
        if (radius < 1) { blobData[i * 4 + 2] = 0.0001; deepData[i * 4 + 3] = 0; continue; }
        blobData.set([r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top, radius, b.seed], i * 4);
        lookData.set([...b.color, b.comp], i * 4);
        deepData.set([...b.deep, b.opacity * body], i * 4);
      }
      return n;
    };
    const setWash = (p: Program, n: number, time: number) => {
      gl.uniform2f(p.u("uRes"), canvas.clientWidth, canvas.clientHeight);
      gl.uniform1f(p.u("uTime"), time);
      gl.uniform1i(p.u("uCount"), n);
      gl.uniform4fv(p.u("uBlob"), blobData);
      gl.uniform4fv(p.u("uLook"), lookData);
      gl.uniform4fv(p.u("uDeep"), deepData);
      gl.uniform1fv(p.u("uShow"), uShow);
      gl.uniform1fv(p.u("uTide"), uTide);
      const t = tuneRef.current;
      gl.uniform1f(p.u("uJoin"), t.join);
      gl.uniform1f(p.u("uWarp"), t.warp);
      gl.uniform1f(p.u("uMorph"), t.morph);
    };
    const setLook = (p: Program, time: number) => {
      const t = tuneRef.current;
      gl.uniform2f(p.u("uRes"), canvas.clientWidth, canvas.clientHeight);
      gl.uniform1f(p.u("uTime"), time);
      gl.uniform1f(p.u("uField"), t.fieldOpacity);
      gl.uniform1f(p.u("uThresh"), t.threshold);
      gl.uniform1f(p.u("uFringe"), t.fringe);
      gl.uniform1f(p.u("uEdge"), t.edge);
      gl.uniform1f(p.u("uSoft"), t.softness);
      gl.uniform1f(p.u("uGrain"), t.grain);
      gl.uniform1f(p.u("uDeepMix"), t.deepTone);
      gl.uniform1f(p.u("uSat"), t.saturation);
      gl.uniform1f(p.u("uPxScale"), canvas.width / Math.max(1, canvas.clientWidth) / (window.devicePixelRatio || 1));
      gl.uniform1f(p.u("uGrainPx"), t.grainPx);
    };

    // Strokes are kept in container px, so a wake stays on the paper as it pans.
    const strokes: Stroke[] = [];
    let prev: { x: number; y: number; t: number } | null = null;
    let vx = 0, vy = 0, lastStroke = -Infinity;
    const onMove = (e: PointerEvent) => {
      const ct = containerRef.current;
      if (!ct) return;
      if ((e.target as Element | null)?.closest?.("[data-tune-panel]")) { prev = null; return; }
      const cr = ct.getBoundingClientRect();
      const x = e.clientX - cr.left, y = e.clientY - cr.top;
      const t = e.timeStamp;
      if (prev && t > prev.t) {
        const dt = Math.min(0.1, (t - prev.t) / 1000);
        const k = 1 - Math.exp(-dt / 0.05);
        vx += ((x - prev.x) / dt - vx) * k;
        vy += ((y - prev.y) / dt - vy) * k;
        if (Math.hypot(vx, vy) > 20) {
          strokes.push({ x0: prev.x, y0: prev.y, x1: x, y1: y, vx, vy });
          if (strokes.length > 32) strokes.shift();
          lastStroke = performance.now();
        }
      }
      prev = { x, y, t };
    };

    const start = performance.now();
    let raf = 0, last = 0;
    let stop: () => void = () => {};

    if (fluid && gl2) {
      const g = gl2;
      const progs = {
        target: link(g, VERT3, TARGET3),
        splat: link(g, VERT3, SPLAT3),
        advectVel: link(g, VERT3, ADVECT_VEL3),
        curl: link(g, VERT3, CURL3),
        vort: link(g, VERT3, VORT3),
        div: link(g, VERT3, DIV3),
        pressure: link(g, VERT3, PRESSURE3),
        grad: link(g, VERT3, GRAD3),
        dye: link(g, VERT3, DYE3),
        composite: link(g, VERT3, COMPOSITE3),
      };
      if (Object.values(progs).some((p) => !p)) { readyRef.current(false); return; }
      const P = progs as { [K in keyof typeof progs]: Program };

      let size = "";
      let vel: Target[] = [], pres: Target[] = [], dye: Target[] = [];
      let target: Target | null = null, curl: Target | null = null, div: Target | null = null;
      let sim = { w: 1, h: 1 }, dyeGrid = { w: 1, h: 1 };
      let fresh = true;
      let flowing = false;
      /** Whether the pointer has stirred the paint since it was laid down; from then on it never snaps. */
      let stirred = false;
      const freeAll = () => {
        [...vel, ...pres, ...dye, target, curl, div].forEach((t) => dropTarget(g, t));
        vel = []; pres = []; dye = []; target = curl = div = null;
      };
      const ensure = () => {
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        const { simLong, dyeLong } = tuneRef.current;
        const key = `${cw}x${ch}|${simLong}|${dyeLong}`;
        if (key === size) return true;
        if (cw < 2 || ch < 2) return false;
        freeAll();
        size = key;
        sim = gridFor(cw, ch, Math.round(simLong));
        dyeGrid = gridFor(cw, ch, Math.round(dyeLong));
        const made = [
          ...(vel = [makeTarget(g, sim.w, sim.h, 1)!, makeTarget(g, sim.w, sim.h, 1)!]),
          ...(pres = [makeTarget(g, sim.w, sim.h, 1)!, makeTarget(g, sim.w, sim.h, 1)!]),
          ...(dye = [makeTarget(g, dyeGrid.w, dyeGrid.h, 3)!, makeTarget(g, dyeGrid.w, dyeGrid.h, 3)!]),
          (target = makeTarget(g, dyeGrid.w, dyeGrid.h, 3)),
          (curl = makeTarget(g, sim.w, sim.h, 1)),
          (div = makeTarget(g, sim.w, sim.h, 1)),
        ];
        if (made.some((t) => !t)) return false;
        fresh = true;
        flowing = false;
        return true;
      };

      const run = (p: Program, to: Target | null, set: () => void) => {
        g.useProgram(p.prog);
        g.bindFramebuffer(g.FRAMEBUFFER, to ? to.fb : null);
        if (to) g.viewport(0, 0, to.w, to.h);
        else g.viewport(0, 0, canvas.width, canvas.height);
        set();
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      };
      let unit = 0;
      const tex = (p: Program, name: string, t: WebGLTexture) => {
        g.activeTexture(g.TEXTURE0 + unit);
        g.bindTexture(g.TEXTURE_2D, t);
        g.uniform1i(p.u(name), unit);
        unit++;
      };
      const pass = (p: Program, to: Target | null, set: () => void) => {
        unit = 0;
        run(p, to, set);
      };
      const swap = (pair: Target[]) => { const t = pair[0]; pair[0] = pair[1]; pair[1] = t; };
      const segData = new Float32Array(SEGS * 4);
      const segVel = new Float32Array(SEGS * 2);
      /** This frame's strokes, for the dye pass to thin the paint under. */
      const segSpeed = new Float32Array(SEGS);
      let wipeSegs = 0;

      const step = (dt: number) => {
        const texel = [1 / sim.w, 1 / sim.h] as const;
        const cell = [canvas.clientWidth / sim.w, canvas.clientHeight / sim.h];
        const segs = strokes.splice(0).slice(-SEGS);
        if (segs.length) {
          segs.forEach((s, k) => {
            segData.set([s.x0, s.y0, s.x1, s.y1], k * 4);
            // container px/s, y down → grid cells/s, y up
            segVel.set([s.vx / cell[0], -s.vy / cell[1]], k * 2);
            segSpeed[k] = Math.hypot(s.vx, s.vy);
          });
          wipeSegs = segs.length;
          pass(P.splat, vel[1], () => {
            tex(P.splat, "uVel", vel[0].tex[0]);
            g.uniform2f(P.splat.u("uRes"), canvas.clientWidth, canvas.clientHeight);
            g.uniform4fv(P.splat.u("uSeg"), segData);
            g.uniform2fv(P.splat.u("uSegVel"), segVel);
            g.uniform1i(P.splat.u("uSegs"), segs.length);
            g.uniform1f(P.splat.u("uRadius"), tuneRef.current.brushPx);
            g.uniform1f(P.splat.u("uGrip"), tuneRef.current.grip);
          });
          swap(vel);
        }
        pass(P.curl, curl, () => {
          tex(P.curl, "uVel", vel[0].tex[0]);
          g.uniform2f(P.curl.u("uTexel"), ...texel);
        });
        pass(P.vort, vel[1], () => {
          tex(P.vort, "uVel", vel[0].tex[0]);
          tex(P.vort, "uCurl", curl!.tex[0]);
          g.uniform2f(P.vort.u("uTexel"), ...texel);
          g.uniform1f(P.vort.u("uDt"), dt);
          g.uniform1f(P.vort.u("uStrength"), tuneRef.current.curl);
        });
        swap(vel);
        pass(P.div, div, () => {
          tex(P.div, "uVel", vel[0].tex[0]);
          g.uniform2f(P.div.u("uTexel"), ...texel);
        });
        const iters = Math.round(tuneRef.current.pressureIters);
        for (let i = 0; i < iters; i++) {
          pass(P.pressure, pres[1], () => {
            tex(P.pressure, "uP", pres[0].tex[0]);
            tex(P.pressure, "uDiv", div!.tex[0]);
            g.uniform2f(P.pressure.u("uTexel"), ...texel);
          });
          swap(pres);
        }
        pass(P.grad, vel[1], () => {
          tex(P.grad, "uP", pres[0].tex[0]);
          tex(P.grad, "uVel", vel[0].tex[0]);
          g.uniform2f(P.grad.u("uTexel"), ...texel);
        });
        swap(vel);
        pass(P.advectVel, vel[1], () => {
          tex(P.advectVel, "uVel", vel[0].tex[0]);
          g.uniform2f(P.advectVel.u("uTexel"), ...texel);
          g.uniform1f(P.advectVel.u("uDt"), dt);
          g.uniform1f(P.advectVel.u("uDecay"), Math.exp(-dt / tuneRef.current.velFadeS));
        });
        swap(vel);
      };

      const clearFlow = () => {
        for (const t of [...vel, ...pres]) {
          g.bindFramebuffer(g.FRAMEBUFFER, t.fb);
          g.clearColor(0, 0, 0, 0);
          g.clear(g.COLOR_BUFFER_BIT);
        }
      };

      let lastT = performance.now();
      const draw = (now: number) => {
        raf = requestAnimationFrame(draw);
        const stirring = now - lastStroke < tuneRef.current.velFadeS * SETTLE_LIVES * 1000;
        if (document.hidden || now - last < (stirring || flowing ? STIR_FRAME_MS : FRAME_MS) - 1) return;
        last = now;
        const dt = Math.min(1 / 30, Math.max(1 / 240, (now - lastT) / 1000));
        lastT = now;
        if (!ensure()) return;
        const n = readBlobs(now);
        if (n < 0) return;
        const time = (now - start) / 1000;
        const growing = opening(now) < revealSpan;

        pass(P.target, target, () => setWash(P.target, n, time));

        if (stirring) {
          step(dt);
          flowing = true;
          stirred = true;
        } else if (flowing) {
          clearFlow();
          flowing = false;
        }

        pass(P.dye, dye[1], () => {
          tex(P.dye, "uA", dye[0].tex[0]);
          tex(P.dye, "uB", dye[0].tex[1]);
          tex(P.dye, "uC", dye[0].tex[2]);
          tex(P.dye, "uTA", target!.tex[0]);
          tex(P.dye, "uTB", target!.tex[1]);
          tex(P.dye, "uTC", target!.tex[2]);
          tex(P.dye, "uVel", vel[0].tex[0]);
          g.uniform2f(P.dye.u("uVelTexel"), 1 / sim.w, 1 / sim.h);
          g.uniform1f(P.dye.u("uDt"), flowing ? dt : 0);
          // opening, unstirred paint follows the growth exactly rather than trailing it;
          // once stirred it follows closely but continuously, so it never jumps
          // back onto the growth when the stirring stops
          const relaxS = growing ? Math.min(GROW_RELAX_S, tuneRef.current.relaxS) : tuneRef.current.relaxS;
          g.uniform1f(P.dye.u("uRelax"), fresh || (growing && !stirred) ? 1 : 1 - Math.exp(-dt / relaxS));
          g.uniform2f(P.dye.u("uRes"), canvas.clientWidth, canvas.clientHeight);
          g.uniform4fv(P.dye.u("uSeg"), segData);
          g.uniform1fv(P.dye.u("uSegSpeed"), segSpeed);
          g.uniform1i(P.dye.u("uSegs"), flowing ? wipeSegs : 0);
          g.uniform1f(P.dye.u("uRadius"), tuneRef.current.brushPx);
          g.uniform1f(P.dye.u("uWipe"), tuneRef.current.wipe);
        });
        wipeSegs = 0;
        swap(dye);
        fresh = false;

        pass(P.composite, null, () => {
          tex(P.composite, "uA", dye[0].tex[0]);
          tex(P.composite, "uB", dye[0].tex[1]);
          tex(P.composite, "uC", dye[0].tex[2]);
          tex(P.composite, "uTA", target!.tex[0]);
          tex(P.composite, "uTC", target!.tex[2]);
          setLook(P.composite, time);
        });
      };
      readyRef.current(true);
      window.addEventListener("pointermove", onMove, { passive: true });
      raf = requestAnimationFrame(draw);
      stop = freeAll;
    } else {
      const p = link(gl, VERT1, FRAG1);
      if (!p) { readyRef.current(false); return; }
      const draw = (now: number) => {
        raf = requestAnimationFrame(draw);
        if (document.hidden || now - last < FRAME_MS) return;
        last = now;
        const n = readBlobs(now);
        if (n < 0) return;
        gl.useProgram(p.prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        setWash(p, n, (now - start) / 1000);
        setLook(p, (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      readyRef.current(true);
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      stop();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [blobEls, containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(width * resolution));
    canvas.height = Math.max(1, Math.round(height * resolution));
  }, [width, height, resolution]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{ width, height }}
    />
  );
}
