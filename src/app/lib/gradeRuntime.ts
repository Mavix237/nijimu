/**
 * Camera and print stage for the render menu.
 *
 * The lens is applied in the scene's own lookAt, after that scene has placed
 * the camera and before it draws, then put back when the menu closes. Pixels
 * are graded from the framebuffer after the scene's own passes (including
 * refraction), so materials and lights are untouched.
 *
 * Compromises, kept on purpose:
 * - Depth of field uses a geometric depth pass. Full-screen overlays that
 *   already opt out of the depth test (the water volume, the descent's
 *   surface) are left out of it, and empty pixels on a transparent canvas
 *   stay sharp so glass keeps a clean edge. A refracted view blurs with the
 *   glass in front of it, not along the bent ray.
 * - f-stop is a photographic scale on the scene's own depth, not a
 *   millimetre circle of confusion. f/16 is exactly sharp.
 * - Grain, halation and paper run per WebGL view, in that view's pixels, at
 *   the same fraction of the frame in the preview and in the export. Plain
 *   2D canvases are composited as they are.
 * - Above the GPU's texture limit the export is a real render at that limit,
 *   not an upscale. These scenes draw through full-frame refraction targets,
 *   so the view is not split into tiles.
 */

import { _roots, addAfterEffect, addEffect, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import {
  GRAIN_SEED,
  type LutId,
  clamp,
  depthActive,
  fovFromFocal,
  focalFromFov,
  gradeFrozen,
  gradeSession,
  kelvinGain,
  lensActive,
  pixelActive,
  readGrade,
} from "./cameraGrade";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GRADE_GLSL = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4)), step(vec3(0.04045), c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float lumaOf(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i + seed);
  float b = hash12(i + vec2(1.0, 0.0) + seed);
  float c = hash12(i + vec2(0.0, 1.0) + seed);
  float d = hash12(i + vec2(1.0, 1.0) + seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float filmGrain(vec2 pix, float cell, float seed) {
  float n = valueNoise(pix / cell, seed);
  n += valueNoise(pix / (cell * 0.57) + vec2(19.2, 7.7), seed + 17.0) * 0.65;
  n += valueNoise(pix / (cell * 1.8) + vec2(4.1, 23.0), seed + 3.0) * 0.32;
  return n / 1.97;
}
vec3 lutFetch(sampler2D tex, float r, float g, float b) {
  float x = r + b * 16.0;
  float y = g;
  return texture2D(tex, (vec2(x, y) + 0.5) / vec2(256.0, 16.0)).rgb;
}
vec3 lutLookup(sampler2D tex, vec3 c) {
  vec3 p = clamp(c, 0.0, 1.0) * 15.0;
  vec3 i0 = floor(p);
  vec3 i1 = min(i0 + 1.0, vec3(15.0));
  vec3 f = p - i0;
  vec3 c000 = lutFetch(tex, i0.x, i0.y, i0.z);
  vec3 c100 = lutFetch(tex, i1.x, i0.y, i0.z);
  vec3 c010 = lutFetch(tex, i0.x, i1.y, i0.z);
  vec3 c110 = lutFetch(tex, i1.x, i1.y, i0.z);
  vec3 c001 = lutFetch(tex, i0.x, i0.y, i1.z);
  vec3 c101 = lutFetch(tex, i1.x, i0.y, i1.z);
  vec3 c011 = lutFetch(tex, i0.x, i1.y, i1.z);
  vec3 c111 = lutFetch(tex, i1.x, i1.y, i1.z);
  return mix(
    mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
    mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y),
    f.z
  );
}
vec3 gradeColor(vec3 rgb, float exposure, float contrast, float rolloff, vec3 gain, float saturation, float lutOn, sampler2D lut) {
  rgb *= exp2(exposure);
  rgb *= gain;
  rgb = vec3(0.18) + (rgb - vec3(0.18)) * (1.0 + contrast);
  if (rolloff > 0.001) {
    float knee = mix(1.0, 0.58, rolloff);
    float compress = mix(1.0, 2.6, rolloff);
    vec3 over = max(rgb - vec3(knee), vec3(0.0));
    rgb = min(rgb, vec3(knee)) + over / (1.0 + over * compress);
  }
  float y = lumaOf(max(rgb, vec3(0.0)));
  rgb = mix(vec3(y), rgb, 1.0 + saturation);
  if (lutOn > 0.5) rgb = lutLookup(lut, clamp(rgb, 0.0, 1.0));
  return max(rgb, vec3(0.0));
}
`;

const OPTICAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uFStop;
uniform float uFocalMm;
uniform float uSoftness;
uniform float uSamples;
uniform float uDof;
uniform float uPremul;
varying vec2 vUv;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow(max((c + 0.055) / 1.055, vec3(0.0)), vec3(2.4)), step(vec3(0.04045), c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
const float UnpackDownscale = 255.0 / 256.0;
const vec4 UnpackFactors4 = vec4(
  UnpackDownscale,
  UnpackDownscale / 256.0,
  UnpackDownscale / 65536.0,
  1.0 / 16777216.0
);
const vec2 DISK[16] = vec2[16](
  vec2(0.00, 0.00), vec2(0.55, 0.06), vec2(-0.30, 0.46), vec2(-0.50, -0.24),
  vec2(0.20, -0.52), vec2(0.76, -0.26), vec2(-0.70, 0.30), vec2(0.06, 0.76),
  vec2(0.46, 0.50), vec2(-0.40, -0.66), vec2(0.86, 0.20), vec2(-0.84, -0.14),
  vec2(0.30, -0.84), vec2(-0.14, -0.90), vec2(0.66, 0.60), vec2(-0.60, 0.66)
);
float unpackRGBAToDepth(vec4 v) { return dot(v, UnpackFactors4); }
float perspectiveDepthToViewZ(float depth, float near, float far) {
  return (near * far) / ((far - near) * depth - far);
}
float viewDistance(vec2 uv) {
  float d = unpackRGBAToDepth(texture2D(uDepth, uv));
  if (d > 0.9995) return uFocus;
  return max(0.02, -perspectiveDepthToViewZ(d, uNear, uFar));
}
void main() {
  vec4 raw = texture2D(uSource, vUv);
  if (raw.a < 0.02) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 rgb = uPremul > 0.5 ? raw.rgb / raw.a : raw.rgb;
  rgb = srgbToLinear(rgb);
  float dist = uDof > 0.5 ? viewDistance(vUv) : uFocus;
  float open = clamp((16.0 - uFStop) / 14.6, 0.0, 1.0);
  float defocus = abs(dist - uFocus) / max(dist, 0.08);
  float radius = defocus * open * clamp(uFocalMm / 50.0, 0.45, 2.2) * uResolution.y * 0.016;
  radius += uSoftness * uResolution.y * 0.0035;
  radius = min(radius, uResolution.y * 0.035);
  if (radius < 0.45) {
    gl_FragColor = vec4(linearToSrgb(rgb), raw.a);
    return;
  }
  vec2 texel = 1.0 / uResolution;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uSamples) break;
    vec2 d = DISK[i];
    vec4 s = texture2D(uSource, vUv + d * radius * texel);
    if (s.a < 0.04) continue;
    vec3 sr = uPremul > 0.5 ? s.rgb / s.a : s.rgb;
    float w = exp(-dot(d, d) * 1.55);
    acc += srgbToLinear(sr) * w;
    wsum += w;
  }
  if (wsum > 0.001) rgb = acc / wsum;
  gl_FragColor = vec4(linearToSrgb(rgb), raw.a);
}
`;

const FINISH_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uHalo;
uniform sampler2D uLut;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uContrast;
uniform float uRolloff;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uLutOn;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainTone;
uniform float uGrainContrast;
uniform float uSeed;
uniform float uHalation;
uniform float uPaper;
uniform float uAberration;
uniform float uPremul;
uniform float uStraight;
uniform float uEncoded;
uniform float uHasHalo;
uniform float uDoGrade;
varying vec2 vUv;
${GRADE_GLSL}
vec3 sampleLinear(vec2 uv) {
  vec4 s = texture2D(uSource, uv);
  vec3 rgb = s.rgb;
  if (uPremul > 0.5 && uStraight < 0.5 && s.a > 0.001) rgb /= s.a;
  if (uEncoded > 0.5) rgb = srgbToLinear(rgb);
  return rgb;
}
float gradedLuma(vec2 uv) {
  vec3 s = sampleLinear(uv);
  if (uDoGrade > 0.5) s = gradeColor(s, uExposure, uContrast, uRolloff, uGain, uSaturation, uLutOn, uLut);
  return lumaOf(s);
}
void main() {
  vec4 raw = texture2D(uSource, vUv);
  if (raw.a < 0.02) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 rgb = sampleLinear(vUv);
  if (uAberration > 0.001) {
    vec2 dir = vUv - 0.5;
    dir.x *= uResolution.x / max(uResolution.y, 1.0);
    float edge = length(dir);
    vec2 off = dir * (uAberration * 0.0024) * edge;
    rgb.r = sampleLinear(vUv + off).r;
    rgb.b = sampleLinear(vUv - off).b;
  }
  if (uDoGrade > 0.5) rgb = gradeColor(rgb, uExposure, uContrast, uRolloff, uGain, uSaturation, uLutOn, uLut);
  if (uHasHalo > 0.5) rgb += texture2D(uHalo, vUv).rgb;
  float cover = smoothstep(0.15, 0.55, raw.a);
  if (uGrain > 0.001 && cover > 0.001) {
    float cell = max(1.25, uGrainSize * uResolution.y * 0.0017);
    float n = filmGrain(gl_FragCoord.xy, cell, uSeed) - 0.5;
    float y = lumaOf(rgb);
    float mid = smoothstep(0.02, 0.2, y) * (1.0 - smoothstep(0.62, 0.96, y));
    float tone = mix(1.0, mix(0.24, 1.0, mid), uGrainTone);
    float boost = 1.0;
    if (uGrainContrast > 0.001) {
      float reach = 0.0035;
      float v = abs(gradedLuma(vUv + vec2(reach, 0.0)) - y);
      v += abs(gradedLuma(vUv - vec2(reach, 0.0)) - y);
      v += abs(gradedLuma(vUv + vec2(0.0, reach)) - y);
      v += abs(gradedLuma(vUv - vec2(0.0, reach)) - y);
      v *= 0.25;
      boost = 1.0 + uGrainContrast * smoothstep(0.012, 0.14, v) * 0.5;
    }
    rgb *= 1.0 + n * uGrain * tone * boost * 0.85 * cover;
  }
  if (uPaper > 0.001 && cover > 0.001) {
    float fine = valueNoise(gl_FragCoord.xy / (uResolution.y * 0.0036), 41.0);
    float low = valueNoise(gl_FragCoord.xy / (uResolution.y * 0.048), 9.0);
    rgb *= 1.0 + uPaper * cover * ((fine - 0.5) * 0.07 + (low - 0.5) * 0.08);
  }
  rgb = linearToSrgb(max(rgb, vec3(0.0)));
  if (uPremul > 0.5) rgb *= raw.a;
  gl_FragColor = vec4(rgb, raw.a);
}
`;

const EXTRACT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uLut;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uContrast;
uniform float uRolloff;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uLutOn;
uniform float uHalation;
uniform float uPremul;
uniform float uStraight;
uniform float uEncoded;
uniform float uDoGrade;
varying vec2 vUv;
${GRADE_GLSL}
void main() {
  vec4 s = texture2D(uSource, vUv);
  if (s.a < 0.02) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 rgb = s.rgb;
  if (uPremul > 0.5 && uStraight < 0.5 && s.a > 0.001) rgb /= s.a;
  if (uEncoded > 0.5) rgb = srgbToLinear(rgb);
  if (uDoGrade > 0.5) rgb = gradeColor(rgb, uExposure, uContrast, uRolloff, uGain, uSaturation, uLutOn, uLut);
  float y = lumaOf(rgb);
  float w = smoothstep(0.58, 0.92, y);
  gl_FragColor = vec4(rgb * w * vec3(1.05, 0.96, 0.9) * uHalation * 0.7, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uDirection;
varying vec2 vUv;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -4; i <= 4; i++) {
    float x = float(i) / 4.0;
    float w = exp(-x * x * 2.1);
    acc += texture2D(uSource, vUv + uDirection * float(i)).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}
`;

type LensRec = {
  orig: THREE.PerspectiveCamera["lookAt"];
  sceneFov: number;
  appliedFov: number;
  looked: boolean;
  focus: number;
};

type Pass = {
  capture: THREE.WebGLRenderTarget | null;
  depth: THREE.WebGLRenderTarget | null;
  optical: THREE.WebGLRenderTarget | null;
  haloA: THREE.WebGLRenderTarget | null;
  haloB: THREE.WebGLRenderTarget | null;
  geo: THREE.BufferGeometry;
  quad: THREE.Mesh;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  opticalMat: THREE.ShaderMaterial;
  finishMat: THREE.ShaderMaterial;
  extractMat: THREE.ShaderMaterial;
  blurMat: THREE.ShaderMaterial;
  depthMat: THREE.MeshDepthMaterial;
  luts: Map<LutId, THREE.DataTexture>;
};

const lenses = new WeakMap<THREE.PerspectiveCamera, LensRec>();
const passes = new Map<THREE.WebGLRenderer, Pass>();
const rendered = new Set<HTMLCanvasElement>();
const watched = new Map<HTMLCanvasElement, () => void>();
const tmpTarget = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpClear = new THREE.Color();

let wired = false;
let heavy = false;
let gradeError: Error | null = null;

const dummyDepth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
dummyDepth.needsUpdate = true;
dummyDepth.magFilter = THREE.NearestFilter;
dummyDepth.minFilter = THREE.NearestFilter;
dummyDepth.colorSpace = THREE.NoColorSpace;

const dummyLut = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
dummyLut.needsUpdate = true;
dummyLut.colorSpace = THREE.NoColorSpace;

function mat(fragment: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: fragment,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NoBlending,
  });
}

function makePass(): Pass {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const opticalMat = mat(OPTICAL_FRAG, {
    uSource: { value: null },
    uDepth: { value: dummyDepth },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 8 },
    uFStop: { value: 16 },
    uFocalMm: { value: 50 },
    uSoftness: { value: 0 },
    uSamples: { value: 8 },
    uDof: { value: 0 },
    uPremul: { value: 1 },
  });
  const finishMat = mat(FINISH_FRAG, {
    uSource: { value: null },
    uHalo: { value: dummyLut },
    uLut: { value: dummyLut },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uExposure: { value: 0 },
    uContrast: { value: 0 },
    uRolloff: { value: 0 },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 0 },
    uLutOn: { value: 0 },
    uGrain: { value: 0 },
    uGrainSize: { value: 1 },
    uGrainTone: { value: 0 },
    uGrainContrast: { value: 0 },
    uSeed: { value: GRAIN_SEED },
    uHalation: { value: 0 },
    uPaper: { value: 0 },
    uAberration: { value: 0 },
    uPremul: { value: 1 },
    uStraight: { value: 0 },
    uEncoded: { value: 1 },
    uHasHalo: { value: 0 },
    uDoGrade: { value: 1 },
  });
  const extractMat = mat(EXTRACT_FRAG, {
    uSource: { value: null },
    uLut: { value: dummyLut },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uExposure: { value: 0 },
    uContrast: { value: 0 },
    uRolloff: { value: 0 },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 0 },
    uLutOn: { value: 0 },
    uHalation: { value: 0 },
    uPremul: { value: 1 },
    uStraight: { value: 0 },
    uEncoded: { value: 1 },
    uDoGrade: { value: 1 },
  });
  const blurMat = mat(BLUR_FRAG, {
    uSource: { value: null },
    uDirection: { value: new THREE.Vector2() },
  });
  const quad = new THREE.Mesh(geo, finishMat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depthMat.blending = THREE.NoBlending;
  depthMat.toneMapped = false;
  return {
    capture: null,
    depth: null,
    optical: null,
    haloA: null,
    haloB: null,
    geo,
    quad,
    scene,
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    opticalMat,
    finishMat,
    extractMat,
    blurMat,
    depthMat,
    luts: new Map(),
  };
}

function passFor(renderer: THREE.WebGLRenderer): Pass {
  let pass = passes.get(renderer);
  if (!pass) {
    pass = makePass();
    passes.set(renderer, pass);
  }
  return pass;
}

function byteTarget(w: number, h: number, filter: THREE.MagnificationTextureFilter): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: filter,
    magFilter: filter,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

function halfTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

function fit(rt: THREE.WebGLRenderTarget | null, w: number, h: number, make: () => THREE.WebGLRenderTarget): THREE.WebGLRenderTarget {
  if (!rt) return make();
  if (rt.width !== w || rt.height !== h) rt.setSize(Math.max(1, w), Math.max(1, h));
  return rt;
}

function colorTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

/** The canvas is multisampled, so a direct copy is invalid. Blit resolves it. */
function captureColor(renderer: THREE.WebGLRenderer, pass: Pass, w: number, h: number): THREE.Texture {
  pass.capture = fit(pass.capture, w, h, () => colorTarget(w, h));
  const target = pass.capture;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const fb = (renderer.properties as unknown as {
    get(t: object): { __webglFramebuffer?: WebGLFramebuffer | null };
  }).get(target).__webglFramebuffer;
  if (!fb || typeof gl.blitFramebuffer !== "function") throw new Error("could not read the frame");
  gl.getError();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
  gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  if (gl.getError() !== gl.NO_ERROR) throw new Error("could not read the frame");
  return target.texture;
}

function sCurve(x: number): number {
  const c = x - 0.5;
  return clamp(x + c * 0.1 - c * c * c * 0.28, 0, 1);
}

function lutColor(r: number, g: number, b: number, id: Exclude<LutId, "off">): [number, number, number] {
  if (id === "print") {
    return [clamp(sCurve(r) * 1.012, 0, 1), sCurve(g), clamp(sCurve(b) * 0.985, 0, 1)];
  }
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lift = (x: number) => clamp(x + 0.035 * Math.exp(-x * 5.5), 0, 1);
  return [
    clamp(lift(y + (r - y) * 0.94) + 0.012, 0, 1),
    lift(y + (g - y) * 0.9),
    clamp(lift(y + (b - y) * 0.94) * 0.99, 0, 1),
  ];
}

function lutTexture(pass: Pass, id: LutId): THREE.DataTexture {
  if (id === "off") return dummyLut;
  const cached = pass.luts.get(id);
  if (cached) return cached;
  const size = 16;
  const data = new Uint8Array(size * size * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const c = lutColor(r / (size - 1), g / (size - 1), b / (size - 1), id);
        const x = r + b * size;
        const i = (g * size * size + x) * 4;
        data[i] = Math.round(c[0] * 255);
        data[i + 1] = Math.round(c[1] * 255);
        data[i + 2] = Math.round(c[2] * 255);
        data[i + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size * size, size);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  pass.luts.set(id, tex);
  return tex;
}

function releaseHeavy() {
  for (const pass of passes.values()) {
    pass.capture?.dispose();
    pass.capture = null;
    pass.depth?.dispose();
    pass.depth = null;
    pass.optical?.dispose();
    pass.optical = null;
    pass.haloA?.dispose();
    pass.haloA = null;
    pass.haloB?.dispose();
    pass.haloB = null;
  }
}

function targetOf(x: number | THREE.Vector3, y?: number, z?: number): THREE.Vector3 {
  if (typeof x === "number") return tmpTarget.set(x, y ?? 0, z ?? 0);
  return tmpTarget.copy(x);
}

function ensureWrap(camera: THREE.PerspectiveCamera) {
  if (lenses.has(camera)) return;
  const orig = camera.lookAt.bind(camera) as THREE.PerspectiveCamera["lookAt"];
  const rec: LensRec = { orig, sceneFov: camera.fov, appliedFov: -1, looked: false, focus: 0 };
  lenses.set(camera, rec);
  camera.lookAt = ((x: number | THREE.Vector3, y?: number, z?: number) => {
    const grade = readGrade();
    const target = targetOf(x, y, z);
    const current = lenses.get(camera);
    if (!current || !gradeSession() || (!lensActive(grade) && !depthActive(grade))) {
      orig(target);
      return;
    }
    current.looked = true;
    if (!lensActive(grade)) {
      current.focus = grade.focusAuto ? Math.max(0.05, camera.position.distanceTo(target)) : grade.focus;
      orig(target);
      return;
    }
    let sceneFov = camera.fov;
    if (current.appliedFov > 0 && Math.abs(camera.fov - current.appliedFov) < 0.04) sceneFov = current.sceneFov;
    else current.sceneFov = camera.fov;
    const next = clamp(fovFromFocal(grade.focalMm ?? sceneFov), 5, 100);
    tmpPos.copy(camera.position);
    if (grade.holdSubject) {
      const dist = Math.max(0.001, tmpPos.distanceTo(target));
      const dNew = dist * Math.tan(THREE.MathUtils.degToRad(sceneFov) / 2) / Math.max(1e-4, Math.tan(THREE.MathUtils.degToRad(next) / 2));
      tmpDir.copy(target).sub(tmpPos);
      if (tmpDir.lengthSq() > 1e-10) {
        tmpDir.normalize();
        camera.position.copy(target).addScaledVector(tmpDir, -dNew);
      }
    }
    camera.fov = next;
    camera.updateProjectionMatrix();
    current.appliedFov = next;
    current.focus = grade.focusAuto ? Math.max(0.05, camera.position.distanceTo(target)) : grade.focus;
    orig(target);
  }) as THREE.PerspectiveCamera["lookAt"];
}

function restoreLens(camera: THREE.PerspectiveCamera) {
  const rec = lenses.get(camera);
  if (!rec) return;
  camera.lookAt = rec.orig;
  if (rec.sceneFov > 0) {
    camera.fov = rec.sceneFov;
    camera.updateProjectionMatrix();
  }
  lenses.delete(camera);
}

/** A full-frame view that keeps moving. Grading it retints the picture and
 *  spends a second buffer, which is what kept an 8K water export from finishing. */
export function motionCanvas(canvas: HTMLCanvasElement): boolean {
  const root = _roots.get(canvas);
  if (!root) return false;
  const state = root.store.getState();
  if (state.frameloop !== "always") return false;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  return rect.width >= window.innerWidth * 0.72 && rect.height >= window.innerHeight * 0.72;
}

export function pageIsMotion(): boolean {
  for (const canvas of _roots.keys()) {
    if (canvas instanceof HTMLCanvasElement && canvas.isConnected && motionCanvas(canvas)) return true;
  }
  return false;
}

function syncLens() {
  const grade = readGrade();
  const on = gradeSession() && (lensActive(grade) || depthActive(grade));
  for (const [canvas, root] of _roots) {
    if (!(canvas instanceof HTMLCanvasElement)) continue;
    const camera = root.store.getState().camera;
    if (!(camera instanceof THREE.PerspectiveCamera)) continue;
    if (!on || motionCanvas(canvas)) {
      if (lenses.has(camera)) restoreLens(camera);
      continue;
    }
    ensureWrap(camera);
    const rec = lenses.get(camera);
    if (!rec) continue;
    rec.looked = false;
    if (lensActive(grade) && rec.appliedFov > 0) {
      camera.fov = rec.sceneFov;
      camera.updateProjectionMatrix();
    }
  }
}

function syncWatchers() {
  const on = pixelActive();
  if (!on) {
    for (const unsub of watched.values()) unsub();
    watched.clear();
    return;
  }
  const live = new Set<HTMLCanvasElement>();
  for (const [canvas, root] of _roots) {
    if (!(canvas instanceof HTMLCanvasElement)) continue;
    if (motionCanvas(canvas)) continue;
    live.add(canvas);
    if (watched.has(canvas)) continue;
    const state = root.store.getState();
    const ref: { current: ((s: RootState, delta: number) => void) | null } = {
      current: () => { rendered.add(canvas); },
    };
    const unsub = state.internal.subscribe(ref, 0, root.store);
    watched.set(canvas, unsub);
  }
  for (const [canvas, unsub] of watched) {
    if (live.has(canvas)) continue;
    unsub();
    watched.delete(canvas);
    const renderer = _roots.get(canvas)?.store.getState().gl;
    if (renderer && passes.has(renderer)) {
      const pass = passes.get(renderer)!;
      pass.capture?.dispose();
      pass.depth?.dispose();
      pass.optical?.dispose();
      pass.haloA?.dispose();
      pass.haloB?.dispose();
      passes.delete(renderer);
    }
  }
}

function hideFromDepth(scene: THREE.Scene): THREE.Object3D[] {
  const hidden: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if (!obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const kind = obj as THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
    if (kind.isPoints || kind.isLine || kind.isSprite) {
      obj.visible = false;
      hidden.push(obj);
      return;
    }
    if (!kind.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.some(m => m && m.depthTest === false)) {
      obj.visible = false;
      hidden.push(obj);
    }
  });
  return hidden;
}

function draw(renderer: THREE.WebGLRenderer, pass: Pass, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
  pass.quad.material = material;
  renderer.setRenderTarget(target);
  renderer.render(pass.scene, pass.camera);
}

function gradeCanvas(canvas: HTMLCanvasElement, full: boolean) {
  if (motionCanvas(canvas)) return;
  const root = _roots.get(canvas);
  if (!root) return;
  const state = root.store.getState();
  const renderer = state.gl;
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  if (w < 2 || h < 2) return;
  const grade = readGrade();
  const camera = state.camera as THREE.PerspectiveCamera;
  const premul = gl.getContextAttributes()?.premultipliedAlpha !== false;
  const pass = passFor(renderer);
  const prevTarget = renderer.getRenderTarget();
  const prevAuto = renderer.autoClear;
  const prevScissor = renderer.getScissorTest();
  const prevViewport = renderer.getViewport(new THREE.Vector4());
  const prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(tmpClear);
  const prevClear = tmpClear.clone();
  const scene = state.scene;
  const prevOverride = scene.overrideMaterial;
  const prevBg = scene.background;
  let hidden: THREE.Object3D[] = [];

  const blur = depthActive(grade) || grade.softness > 0.001;
  const printOn = Math.abs(grade.exposure) > 0.001
    || Math.abs(grade.contrast) > 0.001
    || grade.rolloff > 0.001
    || Math.abs(grade.temperature - 6500) > 1
    || Math.abs(grade.saturation) > 0.001
    || grade.lut !== "off"
    || grade.grain > 0.001
    || grade.halation > 0.001
    || grade.paper > 0.001
    || grade.aberration > 0.001;
  if (!blur && !printOn) return;

  try {
    renderer.setScissorTest(false);
    const color = captureColor(renderer, pass, w, h);

    let source: THREE.Texture = color;
    let sourcePremul = premul ? 1 : 0;
    let sourceStraight = 0;
    const focal = grade.focalMm ?? (camera.isPerspectiveCamera ? focalFromFov(lenses.get(camera)?.sceneFov || camera.fov) : 50);
    const focus = lenses.get(camera)?.focus || (grade.focusAuto ? Math.max(0.2, camera.position.length()) : grade.focus);

    if (blur && camera.isPerspectiveCamera) {
      const samples = full ? 16 : 8;
      if (depthActive(grade)) {
        const dw = Math.max(w, h) > 4096 ? Math.max(2, Math.round(w / 2)) : w;
        const dh = dw === w ? h : Math.max(2, Math.round(h / 2));
        pass.depth = fit(pass.depth, dw, dh, () => byteTarget(dw, dh, THREE.NearestFilter));
        pass.depth.texture.magFilter = THREE.NearestFilter;
        pass.depth.texture.minFilter = THREE.NearestFilter;
        hidden = hideFromDepth(scene);
        scene.overrideMaterial = pass.depthMat;
        scene.background = null;
        renderer.autoClear = true;
        renderer.setClearColor(0xffffff, 1);
        renderer.setRenderTarget(pass.depth);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        scene.overrideMaterial = prevOverride;
        scene.background = prevBg;
        for (const obj of hidden) obj.visible = true;
        hidden = [];
        pass.opticalMat.uniforms.uDepth.value = pass.depth.texture;
        pass.opticalMat.uniforms.uDof.value = 1;
      } else {
        pass.opticalMat.uniforms.uDepth.value = dummyDepth;
        pass.opticalMat.uniforms.uDof.value = 0;
      }
      pass.optical = fit(pass.optical, w, h, () => byteTarget(w, h, THREE.LinearFilter));
      const u = pass.opticalMat.uniforms;
      u.uSource.value = color;
      u.uResolution.value.set(w, h);
      u.uNear.value = camera.near;
      u.uFar.value = Math.max(camera.far, camera.near + 0.01);
      u.uFocus.value = Math.max(0.05, focus);
      u.uFStop.value = grade.fStop;
      u.uFocalMm.value = focal;
      u.uSoftness.value = grade.softness;
      u.uSamples.value = samples;
      u.uPremul.value = premul ? 1 : 0;
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      draw(renderer, pass, pass.opticalMat, pass.optical);
      source = pass.optical.texture;
      sourcePremul = 0;
      sourceStraight = 1;
    }

    const gain = kelvinGain(grade.temperature);
    const lut = lutTexture(pass, grade.lut);
    const doGrade = (
      Math.abs(grade.exposure) > 0.001
      || Math.abs(grade.contrast) > 0.001
      || grade.rolloff > 0.001
      || Math.abs(grade.temperature - 6500) > 1
      || Math.abs(grade.saturation) > 0.001
      || grade.lut !== "off"
    ) ? 1 : 0;

    let halo: THREE.Texture | null = null;
    if (grade.halation > 0.001) {
      const long = Math.max(w, h);
      const hs = !full || long > 4096 ? 0.5 : 1;
      const hw = Math.max(1, Math.round(w * hs));
      const hh = Math.max(1, Math.round(h * hs));
      pass.haloA = fit(pass.haloA, hw, hh, () => halfTarget(hw, hh));
      pass.haloB = fit(pass.haloB, hw, hh, () => halfTarget(hw, hh));
      const e = pass.extractMat.uniforms;
      e.uSource.value = source;
      e.uLut.value = lut;
      e.uResolution.value.set(w, h);
      e.uExposure.value = grade.exposure;
      e.uContrast.value = grade.contrast;
      e.uRolloff.value = grade.rolloff;
      e.uGain.value.set(gain[0], gain[1], gain[2]);
      e.uSaturation.value = grade.saturation;
      e.uLutOn.value = grade.lut === "off" ? 0 : 1;
      e.uHalation.value = grade.halation;
      e.uPremul.value = sourcePremul;
      e.uStraight.value = sourceStraight;
      e.uEncoded.value = 1;
      e.uDoGrade.value = doGrade;
      renderer.autoClear = true;
      draw(renderer, pass, pass.extractMat, pass.haloA);
      const radius = grade.halation * h * 0.012 * hs;
      const step = Math.max(radius / 4, 0.5);
      pass.blurMat.uniforms.uSource.value = pass.haloA.texture;
      pass.blurMat.uniforms.uDirection.value.set(step / hw, 0);
      draw(renderer, pass, pass.blurMat, pass.haloB);
      pass.blurMat.uniforms.uSource.value = pass.haloB.texture;
      pass.blurMat.uniforms.uDirection.value.set(0, step / hh);
      draw(renderer, pass, pass.blurMat, pass.haloA);
      halo = pass.haloA.texture;
    }

    const f = pass.finishMat.uniforms;
    f.uSource.value = source;
    f.uHalo.value = halo ?? dummyLut;
    f.uLut.value = lut;
    f.uResolution.value.set(w, h);
    f.uExposure.value = grade.exposure;
    f.uContrast.value = grade.contrast;
    f.uRolloff.value = grade.rolloff;
    f.uGain.value.set(gain[0], gain[1], gain[2]);
    f.uSaturation.value = grade.saturation;
    f.uLutOn.value = grade.lut === "off" ? 0 : 1;
    f.uGrain.value = grade.grain;
    f.uGrainSize.value = grade.grainSize;
    f.uGrainTone.value = grade.grainTone;
    f.uGrainContrast.value = grade.grainContrast;
    f.uSeed.value = GRAIN_SEED;
    f.uHalation.value = grade.halation;
    f.uPaper.value = grade.paper;
    f.uAberration.value = grade.aberration;
    f.uPremul.value = premul ? 1 : 0;
    f.uStraight.value = sourceStraight;
    f.uEncoded.value = 1;
    f.uHasHalo.value = halo ? 1 : 0;
    f.uDoGrade.value = doGrade;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    const pr = renderer.getPixelRatio() || 1;
    renderer.setViewport(0, 0, w / pr, h / pr);
    draw(renderer, pass, pass.finishMat, null);
  } finally {
    for (const obj of hidden) obj.visible = true;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(prevViewport);
    renderer.autoClear = prevAuto;
    renderer.setScissorTest(prevScissor);
    renderer.setClearColor(prevClear, prevAlpha);
  }
}

function beforeFrame() {
  syncWatchers();
  syncLens();
}

function afterFrame() {
  if (!pixelActive()) {
    rendered.clear();
    if (heavy) {
      releaseHeavy();
      heavy = false;
    }
    return;
  }
  heavy = true;
  const full = gradeFrozen();
  for (const canvas of rendered) {
    try {
      gradeCanvas(canvas, full);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("couldn't render");
      if (full) {
        gradeError = error;
        break;
      }
      console.warn(error);
    }
  }
  rendered.clear();
}

export function ensureGradeRuntime() {
  if (wired) return;
  wired = true;
  addEffect(beforeFrame);
  addAfterEffect(afterFrame);
}

export function consumeGradeError(): Error | null {
  const err = gradeError;
  gradeError = null;
  return err;
}

function primaryCamera(): THREE.PerspectiveCamera | null {
  let best = 0;
  let found: THREE.PerspectiveCamera | null = null;
  for (const [canvas, root] of _roots) {
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.isConnected) continue;
    const rect = canvas.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    if (area <= best) continue;
    const camera = root.store.getState().camera;
    if (!(camera instanceof THREE.PerspectiveCamera)) continue;
    best = area;
    found = camera;
  }
  return found;
}

/** The lens the largest view on screen is actually using, before this menu overrides it. */
export function primaryFocalMm(): number {
  const camera = primaryCamera();
  if (!camera) return 50;
  const rec = lenses.get(camera);
  const fov = rec && rec.sceneFov > 0 ? rec.sceneFov : camera.fov;
  return focalFromFov(fov);
}

/** Where the largest view is focused, in its own world units. */
export function primaryFocus(): number | null {
  const camera = primaryCamera();
  if (!camera) return null;
  const rec = lenses.get(camera);
  if (rec && rec.focus > 0.05) return rec.focus;
  const d = camera.position.length();
  return d > 0.05 ? d : null;
}

ensureGradeRuntime();
