/**
 * Film grain for a finished image, in the image's own pixels — a study of four
 * treatments on the same source, so they can be compared detail for detail.
 *
 * Everything is a function of the pixel's place and a fixed seed, so a grain
 * pattern never changes between renders and the preview at any zoom is the
 * export. The source is never written to: each render fills a separate buffer.
 * Grain moves luminance only (the same step on r, g and b, so the colour is
 * kept), except the hybrid's very faint colour noise. Nothing here blurs,
 * sharpens or grades the image itself.
 *
 *  A · uniform  plain uniform noise, one value per cell of `size` px (whole
 *               pixels), the same everywhere — the baseline.
 *  B · tonal    gaussian noise, its strength following a smooth tonal curve:
 *               most in the midtones, less in the shadows, least in the
 *               highlights.
 *  C · spatial  correlated grain: white noise filtered to grain at two sizes,
 *               mixed unevenly over the frame and gathered into faint clumps;
 *               even in strength across the tones.
 *  D · hybrid   C's kind of grain, finer, with B's tonal response, set into
 *               the image's own local contrast, and a breath of colour noise —
 *               a finely scanned medium-format negative.
 *
 * Operates on any `{ width, height, data }` RGBA buffer (ImageData is one), so
 * it can serve another renderer's output as it is.
 */

export type GrainKind = "off" | "uniform" | "tonal" | "spatial" | "hybrid";

export interface GrainSettings {
  kind: GrainKind;
  /** 0…1 */
  intensity: number;
  /** The grain's size in output pixels. */
  size: number;
}

export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export const GRAIN_KINDS: readonly { kind: GrainKind; label: string }[] = [
  { kind: "off", label: "Off" },
  { kind: "uniform", label: "A · Uniform" },
  { kind: "tonal", label: "B · Tonal" },
  { kind: "spatial", label: "C · Spatial" },
  { kind: "hybrid", label: "D · Hybrid" },
];

export const GRAIN_INTENSITY = { min: 0, max: 1 } as const;
export const GRAIN_SIZE = { min: .5, max: 3 } as const;
export const GRAIN_DEFAULT: GrainSettings = { kind: "off", intensity: .4, size: 1 };
/** One seed for every render, so the pattern holds still between options. */
export const GRAIN_SEED = 0x6e696a69;

/** The grain's standard deviation at full intensity, as a share of white. */
const GRAIN_SIGMA = .08;
/** How many grain fields one study keeps (each is a float per pixel). */
const FIELD_CACHE = 6;

export function grainSettingsOf(value: unknown): GrainSettings {
  const v = (value ?? {}) as Partial<GrainSettings>;
  const kind = GRAIN_KINDS.some(k => k.kind === v.kind) ? v.kind as GrainKind : GRAIN_DEFAULT.kind;
  const num = (x: unknown, lo: number, hi: number, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
  return {
    kind,
    intensity: num(v.intensity, GRAIN_INTENSITY.min, GRAIN_INTENSITY.max, GRAIN_DEFAULT.intensity),
    size: num(v.size, GRAIN_SIZE.min, GRAIN_SIZE.max, GRAIN_DEFAULT.size),
  };
}

/* ---- noise ---- */

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Roughly gaussian, mean 0, deviation 1 (the sum of four uniforms). */
function gauss(x: number, y: number, seed: number): number {
  return (hash(x, y, seed) + hash(x, y, seed + 1) + hash(x, y, seed + 2) + hash(x, y, seed + 3) - 2) * 1.7320508;
}

function whiteField(w: number, h: number, seed: number): Float32Array {
  const f = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) f[i] = gauss(x, y, seed);
  return f;
}

/** Uniform noise held over square cells of whole pixels, deviation 1. */
function uniformCells(w: number, h: number, cell: number, seed: number): Float32Array {
  const f = new Float32Array(w * h);
  const c = Math.max(1, Math.round(cell));
  for (let y = 0, i = 0; y < h; y++) {
    const cy = Math.floor(y / c);
    for (let x = 0; x < w; x++, i++) f[i] = (hash(Math.floor(x / c), cy, seed) - .5) * 3.4641016;
  }
  return f;
}

/** Gaussian values on a lattice `cell` px apart, smoothly interpolated (value noise). */
function smoothCells(w: number, h: number, cell: number, seed: number): Float32Array {
  const c = Math.max(.25, cell);
  const lw = Math.ceil(w / c) + 2, lh = Math.ceil(h / c) + 2;
  const lattice = new Float32Array(lw * lh);
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) lattice[j * lw + i] = gauss(i, j, seed);
  const f = new Float32Array(w * h);
  for (let y = 0, k = 0; y < h; y++) {
    const gy = y / c, iy = Math.floor(gy);
    let ty = gy - iy; ty = ty * ty * (3 - 2 * ty);
    const r0 = iy * lw, r1 = r0 + lw;
    for (let x = 0; x < w; x++, k++) {
      const gx = x / c, ix = Math.floor(gx);
      let tx = gx - ix; tx = tx * tx * (3 - 2 * tx);
      const a = lattice[r0 + ix] + (lattice[r0 + ix + 1] - lattice[r0 + ix]) * tx;
      const b = lattice[r1 + ix] + (lattice[r1 + ix + 1] - lattice[r1 + ix]) * tx;
      f[k] = a + (b - a) * ty;
    }
  }
  return f;
}

/** A separable gaussian, edges held. */
function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const kernel = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        acc += src[row + xx] * kernel[k + r];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        acc += tmp[yy * w + x] * kernel[k + r];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** Mean 0, deviation 1, in place. */
function normalize(f: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < f.length; i++) mean += f[i];
  mean /= f.length;
  let v = 0;
  for (let i = 0; i < f.length; i++) { const d = f[i] - mean; v += d * d; }
  const inv = 1 / Math.max(1e-6, Math.sqrt(v / f.length));
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - mean) * inv;
  return f;
}

/* ---- the grains ---- */

/**
 * Grain at two sizes, mixed by a slow field so its size wanders over the frame,
 * and gathered into faint clumps by another. `fine`/`coarse` are the filters'
 * spreads in units of the grain size, `speck` how much unfiltered noise is left
 * on top (a scanner's own crispness).
 */
function organicField(w: number, h: number, size: number, seed: number,
  shape: { fine: number; coarse: number; mixAt: number; clumpAt: number; clump: number; speck: number }): Float32Array {
  const fine = normalize(blur(whiteField(w, h, seed + 11), w, h, Math.max(.35, shape.fine * size)));
  const coarse = normalize(blur(whiteField(w, h, seed + 23), w, h, Math.max(.5, shape.coarse * size)));
  const mix = normalize(smoothCells(w, h, shape.mixAt * size, seed + 31));
  const clump = normalize(smoothCells(w, h, shape.clumpAt * size, seed + 41));
  const speck = shape.speck > 0 ? whiteField(w, h, seed + 53) : null;
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) {
    const t = Math.min(.9, Math.max(.1, .5 + .22 * mix[i]));
    const g = fine[i] * (1 - t) + coarse[i] * t + (speck ? speck[i] * shape.speck : 0);
    f[i] = g * Math.max(.25, 1 + shape.clump * clump[i]);
  }
  return normalize(f);
}

const SPATIAL = { fine: .4, coarse: .75, mixAt: 13, clumpAt: 9, clump: .15, speck: 0 } as const;
const HYBRID = { fine: .32, coarse: .7, mixAt: 9, clumpAt: 6, clump: .2, speck: .18 } as const;

/** Correlated grain at the same deviation reads stronger than white noise (more of it
 *  is coarse enough to see), so each kind is scaled to look about as strong at one intensity. */
const KIND_GAIN: Record<Exclude<GrainKind, "off">, number> = { uniform: 1, tonal: 1, spatial: .55, hybrid: .85 };

/* ---- tonal response, as tables over luminance ---- */

const LUT = 1024;
function table(fn: (y: number) => number): Float32Array {
  const t = new Float32Array(LUT + 1);
  for (let i = 0; i <= LUT; i++) t[i] = fn(i / LUT);
  return t;
}
/** Peaks in the low midtones (.38), falls smoothly toward black and further toward white. */
const TA = .8, TB = 1.3, TPEAK = TA / (TA + TB);
const TNORM = 1 / (Math.pow(TPEAK, TA) * Math.pow(1 - TPEAK, TB));
const curve = (y: number) => Math.pow(y, TA) * Math.pow(1 - y, TB) * TNORM;
let tables: { tonal: Float32Array; hybrid: Float32Array; even: Float32Array } | null = null;
function tonalTables() {
  return tables ??= {
    tonal: table(y => .15 + .85 * curve(y)),
    hybrid: table(y => .3 + .7 * curve(y)),
    // even across the tones; only kept from clipping at the very ends
    even: table(y => 1 - Math.pow(Math.abs(2 * y - 1), 8)),
  };
}

/* ---- the study ---- */

/**
 * One source image and its grains. The grain fields are built once per kind and
 * size and kept, so changing the intensity or going back to a kind already seen
 * is only the final pass.
 */
export class GrainStudy {
  private luma: Float32Array | null = null;
  private fields = new Map<string, Float32Array[]>();
  private means = new Map<number, Float32Array>();

  constructor(readonly source: Pixels, readonly seed: number = GRAIN_SEED) {}

  /**
   * The source with `settings`' grain, written into `out` (a new buffer if none is given).
   * `pixelScale` is how many output pixels one grain covers on each axis. At 2 the field
   * is built on the 1× grid and each sample fills a 2×2 block, so the grain does not
   * get finer just because the canvas is larger. Size and intensity are not scaled.
   */
  render(settings: GrainSettings, out?: Pixels, pixelScale = 1): Pixels {
    const { width: w, height: h, data: src } = this.source;
    const target: Pixels = out && out.width === w && out.height === h
      ? out
      : { width: w, height: h, data: new Uint8ClampedArray(src.length) };
    const dst = target.data;
    const s = grainSettingsOf(settings);
    if (s.kind === "off" || s.intensity <= 0) { dst.set(src); return target; }
    const scale = Math.max(1, Math.round(pixelScale) || 1);
    const sigma = GRAIN_SIGMA * s.intensity * KIND_GAIN[s.kind];
    const size = Math.round(s.size * 20) / 20;
    const [g, cr, cb] = this.field(s.kind, size, scale);
    const gw = Math.max(1, Math.ceil(w / scale));
    const luma = this.lumaOf();
    const tone = tonalTables();
    const curveOf = s.kind === "tonal" ? tone.tonal : s.kind === "hybrid" ? tone.hybrid : s.kind === "spatial" ? tone.even : null;
    const mean = s.kind === "hybrid" ? this.meanOf(size) : null;
    // the hybrid's grain also stretches or flattens the image's own local contrast
    const local = 3 * sigma;
    const tint = .08 * sigma;
    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / scale) * gw;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p = i * 4;
        const gi = row + Math.min(gw - 1, Math.floor(x / scale));
        const yv = luma[i];
        const n = g[gi];
        let d = sigma * n * (curveOf ? curveOf[Math.round(yv * LUT)] : 1);
        if (mean) d += (yv - mean[i]) * local * n;
        let dr = d, dg = d, db = d;
        if (cr && cb) {
          const r = tint * cr[gi], b = tint * cb[gi];
          dr += r; db += b; dg -= (.2126 * r + .0722 * b) / .7152;
        }
        dst[p] = src[p] + dr * 255;
        dst[p + 1] = src[p + 1] + dg * 255;
        dst[p + 2] = src[p + 2] + db * 255;
        dst[p + 3] = src[p + 3];
      }
    }
    return target;
  }

  private lumaOf(): Float32Array {
    if (this.luma) return this.luma;
    const { width: w, height: h, data } = this.source;
    const l = new Float32Array(w * h);
    for (let i = 0, p = 0; i < l.length; i++, p += 4) l[i] = Math.min(1, (.2126 * data[p] + .7152 * data[p + 1] + .0722 * data[p + 2]) / 255);
    return this.luma = l;
  }

  private meanOf(size: number): Float32Array {
    let m = this.means.get(size);
    if (!m) {
      m = blur(this.lumaOf(), this.source.width, this.source.height, 2.2 * size + 1);
      this.means.clear();
      this.means.set(size, m);
    }
    return m;
  }

  private field(kind: Exclude<GrainKind, "off">, size: number, scale = 1): Float32Array[] {
    const key = scale === 1 ? `${kind}|${size}` : `${kind}|${size}|${scale}`;
    const kept = this.fields.get(key);
    if (kept) { this.fields.delete(key); this.fields.set(key, kept); return kept; }
    const { width: w, height: h } = this.source;
    const gw = Math.max(1, Math.ceil(w / scale));
    const gh = Math.max(1, Math.ceil(h / scale));
    const seed = this.seed;
    const made =
      kind === "uniform" ? [uniformCells(gw, gh, size, seed)]
      : kind === "tonal" ? [normalize(smoothCells(gw, gh, size, seed + 5))]
      : kind === "spatial" ? [organicField(gw, gh, size, seed, SPATIAL)]
      : [
        organicField(gw, gh, size, seed + 101, HYBRID),
        normalize(blur(whiteField(gw, gh, seed + 151), gw, gh, Math.max(.5, .6 * size))),
        normalize(blur(whiteField(gw, gh, seed + 161), gw, gh, Math.max(.5, .6 * size))),
      ];
    this.fields.set(key, made);
    while (this.fields.size > FIELD_CACHE) this.fields.delete(this.fields.keys().next().value as string);
    return made;
  }
}

/** A one-off render: the source with this grain, as a new buffer. */
export function applyFilmGrain(source: Pixels, settings: GrainSettings, seed: number = GRAIN_SEED): Pixels {
  return new GrainStudy(source, seed).render(settings);
}
