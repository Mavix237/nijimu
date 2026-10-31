import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";

/* The landing's gooey field, drawn in WebGL so every browser shows it.

   The field used to be `filter: url(#gooey)` over the blob divs. Chrome drew
   it; Safari skipped the SVG filter (composited, animated children under a
   reference filter, on a layer wider than its filter buffers) and showed the
   soft blobs alone. This canvas draws the same thing, reading each blob div's
   live box, transform, corner radii, blur and opacity every frame — so the
   CSS animations and the scene's own JS stay the source of motion — and does
   the filter's work itself:

     1. each blob: its CSS shape (elliptical corners), gradient, blur (a
        Gaussian edge on the shape's distance) and opacity, multiplied over
        the ones before it in an isolated group — the blob layer as drawn;
     2. that layer, in linearRGB as SVG filters work, blurred (feGaussianBlur);
     3. its alpha × mul + off (feColorMatrix) — the hard pooled outline;
     4. the layer painted atop it (feComposite atop), back to sRGB.

   The divs stay mounted and are hidden while this draws. */

export interface GooeyParams {
  /** feGaussianBlur stdDeviation, CSS px. */
  sigma: number;
  /** feColorMatrix alpha row: a' = a·mul + off. */
  alphaMul: number;
  alphaOff: number;
}

interface Props {
  /** The blob divs, in paint order. */
  els: MutableRefObject<(HTMLElement | null)[]>;
  /** Each blob's CSS background (a radial-gradient, or a hex). */
  colors: string[];
  /** The field's size in CSS px (the canvas fills it). */
  width: number;
  height: number;
  /** Draw now (the gooey state); the canvas is hidden otherwise. */
  active: boolean;
  params: GooeyParams;
  /** Whether WebGL2 drew; false keeps the SVG filter as the fallback. */
  onSupport: (ok: boolean) => void;
}

/** Space round the field the blur reads from (> 3σ at σ 18). */
const PAD = 64;
/** The layer and its blur are drawn at half the CSS resolution: everything
    in them is already soft. Only the final threshold is drawn full size. */
const LAYER_RES = 0.5;
/** The final pass's pixel budget (the field is ~1.8× the screen). */
const OUT_PIXELS = 6e6;
const ROWS = 8;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;

const LAYER_FRAG = `${COMMON}
uniform highp sampler2D uData;
uniform int uCount;
uniform float uRes;
uniform float uPad;
uniform bool uLinear;

float normalCdf(float x) {
  x = clamp(x, -6.0, 6.0);
  return 0.5 * (1.0 + tanh(0.7978845608 * (x + 0.044715 * x * x * x)));
}
float ellipseDist(vec2 p, vec2 r) {
  r = max(r, vec2(1e-3));
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k1 < 1e-6 ? -min(r.x, r.y) : k0 * (k0 - 1.0) / k1;
}
/* Signed distance to a CSS border-radius box: half extents he, corner radii
   top = (tl.x, tl.y, tr.x, tr.y), bot = (br.x, br.y, bl.x, bl.y). */
float shapeDist(vec2 q, vec2 he, vec4 top, vec4 bot) {
  float d = max(abs(q.x) - he.x, abs(q.y) - he.y);
  vec2 c = vec2(-he.x + top.x, -he.y + top.y);
  if (q.x < c.x && q.y < c.y) d = max(d, ellipseDist(q - c, top.xy));
  c = vec2(he.x - top.z, -he.y + top.w);
  if (q.x > c.x && q.y < c.y) d = max(d, ellipseDist(q - c, top.zw));
  c = vec2(he.x - bot.x, he.y - bot.y);
  if (q.x > c.x && q.y > c.y) d = max(d, ellipseDist(q - c, bot.xy));
  c = vec2(-he.x + bot.z, he.y - bot.w);
  if (q.x < c.x && q.y > c.y) d = max(d, ellipseDist(q - c, bot.zw));
  return d;
}

void main() {
  // field px, y down (texture row 0 is the field's top edge, less the pad)
  vec2 p = gl_FragCoord.xy / uRes - uPad;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 512; i++) {
    if (i >= uCount) break;
    vec4 r0 = texelFetch(uData, ivec2(0, i), 0);
    vec4 r1 = texelFetch(uData, ivec2(1, i), 0);
    vec4 r2 = texelFetch(uData, ivec2(2, i), 0);
    vec2 q = vec2(dot(r0.xyz, vec3(p, 1.0)), dot(r1.xyz, vec3(p, 1.0)));
    vec2 he = r2.xy;
    float sigma = max(r2.z, 0.35);
    if (r2.w <= 0.0 || any(greaterThan(abs(q), he + 3.5 * sigma))) continue;
    vec4 r3 = texelFetch(uData, ivec2(3, i), 0);
    vec4 r4 = texelFetch(uData, ivec2(4, i), 0);
    vec4 r5 = texelFetch(uData, ivec2(5, i), 0);
    vec3 c1 = texelFetch(uData, ivec2(6, i), 0).rgb;
    vec3 c2 = texelFetch(uData, ivec2(7, i), 0).rgb;
    float cover = normalCdf(-shapeDist(q, he, r3, r4) / sigma) * r2.w;
    vec3 col = mix(c1, c2, clamp(length((q - r5.xy) / r5.zw), 0.0, 1.0));
    vec4 s = vec4(col * cover, cover);
    // mix-blend-mode: multiply in an isolated group, premultiplied
    acc = vec4(s.rgb * (1.0 - acc.a) + acc.rgb * (1.0 - s.a) + s.rgb * acc.rgb,
               s.a + acc.a - s.a * acc.a);
  }
  if (uLinear && acc.a > 0.0) acc.rgb = toLinear(acc.rgb / acc.a) * acc.a;
  o = acc;
}`;

const BLUR_FRAG = `${COMMON}
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uSigma;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uTex, 0));
  vec4 sum = texture(uTex, uv);
  float wsum = 1.0;
  float inv = 1.0 / (2.0 * uSigma * uSigma);
  float reach = ceil(3.0 * uSigma);
  // pairs of taps folded into one bilinear fetch
  for (int k = 1; k < 96; k += 2) {
    if (float(k) > reach) break;
    float a = float(k), b = a + 1.0;
    float wa = exp(-a * a * inv), wb = exp(-b * b * inv);
    float w = wa + wb;
    vec2 off = uStep * (a * wa + b * wb) / w;
    sum += (texture(uTex, uv + off) + texture(uTex, uv - off)) * w;
    wsum += 2.0 * w;
  }
  o = sum / wsum;
}`;

const OUT_FRAG = `${COMMON}
uniform sampler2D uLayer;
uniform sampler2D uBlur;
uniform vec2 uOutPx;
uniform vec2 uField;
uniform float uPad;
uniform float uMul;
uniform float uOff;
uniform bool uLinear;
void main() {
  vec2 css = vec2(gl_FragCoord.x, uOutPx.y - gl_FragCoord.y) * uField / uOutPx;
  vec2 uv = (css + uPad) / (uField + 2.0 * uPad);
  vec4 s = texture(uLayer, uv);
  vec4 b = texture(uBlur, uv);
  float ag = clamp(b.a * uMul + uOff, 0.0, 1.0);
  vec3 cb = b.a > 1e-5 ? b.rgb / b.a : vec3(0.0);
  vec3 rgb = s.rgb * ag + cb * ag * (1.0 - s.a);
  vec3 un = ag > 1e-5 ? rgb / ag : vec3(0.0);
  if (uLinear) un = toSrgb(un);
  o = vec4(un * ag, ag);
}`;

interface Gradient { gx: number; gy: number; c1: number[]; c2: number[] }

function hex(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const GRADIENT = /at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})/i;
function parseBackground(css: string): Gradient {
  const m = css.match(GRADIENT);
  if (m) return { gx: +m[1] / 100, gy: +m[2] / 100, c1: hex(m[3]), c2: hex(m[4]) };
  const solid = hex(css.match(/#[0-9a-f]{6}/i)?.[0] ?? "#808080");
  return { gx: 0.5, gy: 0.5, c1: solid, c2: solid };
}

function corner(v: string, w: number, h: number): [number, number] {
  const parts = v.trim().split(/\s+/);
  const one = (s: string | undefined, len: number) =>
    !s ? 0 : s.endsWith("%") ? (parseFloat(s) / 100) * len : parseFloat(s) || 0;
  return [one(parts[0], w), one(parts[1] ?? parts[0], h)];
}

const BLUR = /blur\(\s*([\d.]+)px\s*\)/;

/** One blob's row block, from its div's live computed style. False if it
    has no box yet. */
function writeBlob(out: Float32Array, at: number, el: HTMLElement, cs: CSSStyleDeclaration, g: Gradient): boolean {
  const w = parseFloat(cs.width);
  const h = parseFloat(cs.height);
  if (!(w > 0 && h > 0)) return false;
  const left = parseFloat(cs.left) || 0;
  const top = parseFloat(cs.top) || 0;
  const m = cs.transform && cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform) : new DOMMatrixReadOnly();
  const sc = (cs.scale && cs.scale !== "none" ? cs.scale : "1").split(/\s+/).map(parseFloat);
  const sx = sc[0] || 1;
  const sy = sc[1] ?? sx;
  // field point = (left, top) + origin + S·(M·q + t), q centred in the box
  const a = sx * m.a, b = sy * m.b, c = sx * m.c, d = sy * m.d;
  const tx = left + w / 2 + sx * m.e;
  const ty = top + h / 2 + sy * m.f;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return false;
  const ia = d / det, ib = -c / det, ic = -b / det, id = a / det;
  let tl = corner(cs.borderTopLeftRadius, w, h);
  let tr = corner(cs.borderTopRightRadius, w, h);
  let br = corner(cs.borderBottomRightRadius, w, h);
  let bl = corner(cs.borderBottomLeftRadius, w, h);
  // CSS scales every radius down together when a side's pair overflows it
  const f = Math.min(1, w / (tl[0] + tr[0] || 1), w / (bl[0] + br[0] || 1),
    h / (tl[1] + bl[1] || 1), h / (tr[1] + br[1] || 1));
  if (f < 1) [tl, tr, br, bl] = [tl, tr, br, bl].map(([x, y]) => [x * f, y * f] as [number, number]);
  const sigma = parseFloat(cs.filter.match(BLUR)?.[1] ?? el.style.filter.match(BLUR)?.[1] ?? "0");
  const opacity = parseFloat(cs.opacity);
  // radial-gradient(ellipse at gx gy): farthest-corner, the farthest-side
  // ellipse grown by √2
  const gcx = g.gx * w, gcy = g.gy * h;
  const rx = Math.max(gcx, w - gcx) * Math.SQRT2 || 1;
  const ry = Math.max(gcy, h - gcy) * Math.SQRT2 || 1;
  out.set([
    ia, ib, -(ia * tx + ib * ty), 0,
    ic, id, -(ic * tx + id * ty), 0,
    w / 2, h / 2, sigma, Number.isFinite(opacity) ? opacity : 1,
    tl[0], tl[1], tr[0], tr[1],
    br[0], br[1], bl[0], bl[1],
    gcx - w / 2, gcy - h / 2, rx, ry,
    g.c1[0], g.c1[1], g.c1[2], 0,
    g.c2[0], g.c2[1], g.c2[2], 0,
  ], at);
  return true;
}

interface Target { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }

interface Gl {
  gl: WebGL2RenderingContext;
  layer: WebGLProgram;
  blur: WebGLProgram;
  out: WebGLProgram;
  vao: WebGLVertexArrayObject;
  data: WebGLTexture;
  linear: boolean;
  targets: Target[];
  key: string;
}

function program(gl: WebGL2RenderingContext, frag: string): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("gooey shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = make(gl.VERTEX_SHADER, VERT);
  const f = make(gl.FRAGMENT_SHADER, frag);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("gooey program:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function setup(canvas: HTMLCanvasElement): Gl | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
  });
  if (!gl) return null;
  const layer = program(gl, LAYER_FRAG);
  const blur = program(gl, BLUR_FRAG);
  const out = program(gl, OUT_FRAG);
  if (!layer || !blur || !out) return null;
  // half floats keep the linearRGB layer from banding in the dark blobs
  const linear = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  const data = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { gl, layer, blur, out, vao: gl.createVertexArray()!, data, linear, targets: [], key: "" };
}

function makeTarget(g: Gl, w: number, h: number): Target {
  const { gl } = g;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (g.linear) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, w, h };
}

function sizeTargets(g: Gl, fieldW: number, fieldH: number) {
  const w = Math.max(1, Math.round((fieldW + 2 * PAD) * LAYER_RES));
  const h = Math.max(1, Math.round((fieldH + 2 * PAD) * LAYER_RES));
  const key = `${w}x${h}`;
  if (g.key === key) return;
  for (const t of g.targets) {
    g.gl.deleteTexture(t.tex);
    g.gl.deleteFramebuffer(t.fb);
  }
  g.targets = [makeTarget(g, w, h), makeTarget(g, w, h), makeTarget(g, w, h)];
  if (g.gl.checkFramebufferStatus(g.gl.FRAMEBUFFER) !== g.gl.FRAMEBUFFER_COMPLETE && g.linear) {
    // the float target would not attach: fall back to 8-bit sRGB
    g.linear = false;
    g.key = "";
    sizeTargets(g, fieldW, fieldH);
    return;
  }
  g.key = key;
}

function draw(g: Gl, canvas: HTMLCanvasElement, data: Float32Array, count: number,
  fieldW: number, fieldH: number, p: GooeyParams) {
  const { gl } = g;
  sizeTargets(g, fieldW, fieldH);
  const [layer, half, blurred] = g.targets;
  gl.bindVertexArray(g.vao);
  gl.disable(gl.BLEND);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, g.data);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, ROWS, Math.max(1, count), 0, gl.RGBA, gl.FLOAT,
    count ? data.subarray(0, count * ROWS * 4) : new Float32Array(ROWS * 4));

  // 1. the blob layer
  gl.useProgram(g.layer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fb);
  gl.viewport(0, 0, layer.w, layer.h);
  gl.uniform1i(gl.getUniformLocation(g.layer, "uData"), 0);
  gl.uniform1i(gl.getUniformLocation(g.layer, "uCount"), count);
  gl.uniform1f(gl.getUniformLocation(g.layer, "uRes"), layer.w / (fieldW + 2 * PAD));
  gl.uniform1f(gl.getUniformLocation(g.layer, "uPad"), PAD);
  gl.uniform1i(gl.getUniformLocation(g.layer, "uLinear"), g.linear ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 2. its blur, across then down
  const sigma = Math.max(0.01, p.sigma * LAYER_RES);
  gl.useProgram(g.blur);
  gl.uniform1i(gl.getUniformLocation(g.blur, "uTex"), 0);
  gl.uniform1f(gl.getUniformLocation(g.blur, "uSigma"), sigma);
  const step = gl.getUniformLocation(g.blur, "uStep");
  gl.bindFramebuffer(gl.FRAMEBUFFER, half.fb);
  gl.bindTexture(gl.TEXTURE_2D, layer.tex);
  gl.uniform2f(step, 1 / layer.w, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, blurred.fb);
  gl.bindTexture(gl.TEXTURE_2D, half.tex);
  gl.uniform2f(step, 0, 1 / layer.h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 3–4. threshold and composite, full size
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(g.out);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, layer.tex);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, blurred.tex);
  gl.uniform1i(gl.getUniformLocation(g.out, "uLayer"), 0);
  gl.uniform1i(gl.getUniformLocation(g.out, "uBlur"), 1);
  gl.uniform2f(gl.getUniformLocation(g.out, "uOutPx"), canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(g.out, "uField"), fieldW, fieldH);
  gl.uniform1f(gl.getUniformLocation(g.out, "uPad"), PAD);
  gl.uniform1f(gl.getUniformLocation(g.out, "uMul"), p.alphaMul);
  gl.uniform1f(gl.getUniformLocation(g.out, "uOff"), p.alphaOff);
  gl.uniform1i(gl.getUniformLocation(g.out, "uLinear"), g.linear ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);
}

export function GooeyBlobCanvas({ els, colors, width, height, active, params, onSupport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<Gl | null>(null);
  const live = useRef({ colors, width, height, params, onSupport });
  live.current = { colors, width, height, params, onSupport };
  const gradients = useRef<{ css: string; g: Gradient }[]>([]);
  const last = useRef<{ data: Float32Array; key: string } | null>(null);
  const failed = useRef(false);

  // Draws one frame if anything changed since the last one.
  const frame = useRef(() => {});
  frame.current = () => {
    const g = glRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const { colors: bg, width: fw, height: fh, params: p } = live.current;
    const dpr = window.devicePixelRatio || 1;
    const res = Math.min(dpr, Math.sqrt(OUT_PIXELS / Math.max(1, fw * fh)));
    const cw = Math.max(1, Math.round(fw * res));
    const ch = Math.max(1, Math.round(fh * res));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      last.current = null;
    }
    const list = els.current;
    const data = new Float32Array(Math.max(1, list.length) * ROWS * 4);
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (!el) continue;
      const css = bg[i] ?? "";
      let cached = gradients.current[i];
      if (!cached || cached.css !== css) cached = gradients.current[i] = { css, g: parseBackground(css) };
      if (writeBlob(data, count * ROWS * 4, el, getComputedStyle(el), cached.g)) count++;
    }
    const key = `${count}|${fw}x${fh}|${cw}x${ch}|${p.sigma}|${p.alphaMul}|${p.alphaOff}`;
    const prev = last.current;
    if (prev && prev.key === key && prev.data.length === data.length && prev.data.every((v, i) => v === data[i])) return;
    last.current = { data, key };
    draw(g, canvas, data, count, fw, fh, p);
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = setup(canvas);
    if (!g) {
      failed.current = true;
      live.current.onSupport(false);
      return;
    }
    glRef.current = g;
    const lost = (e: Event) => {
      e.preventDefault();
      glRef.current = null;
      failed.current = true;
      live.current.onSupport(false);
    };
    canvas.addEventListener("webglcontextlost", lost);
    frame.current();
    live.current.onSupport(true);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      g.gl.getExtension("WEBGL_lose_context")?.loseContext();
      glRef.current = null;
    };
  }, []);

  // One draw before the browser paints, then every frame while gooey.
  useLayoutEffect(() => {
    if (!active || failed.current) return;
    last.current = null;
    frame.current();
    let raf = 0;
    const tick = () => {
      frame.current();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    last.current = null;
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      data-gooey-field=""
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", display: active ? "block" : "none" }}
    />
  );
}
