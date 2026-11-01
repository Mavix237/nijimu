import { CHROME_GRAY } from "./colors";
import { SERIF, SERIF_CJK } from "./theme";
import { oklabToSrgb, type Oklch } from "./oklch";
import { GrainStudy, grainSettingsOf, type GrainSettings } from "./filmGrain";

/**
 * The downloaded image's ground: a seamless studio sweep photographed in
 * soft, slightly overexposed light. Nothing is drawn as a shape. The page is
 * a light field — a near-white base with several very large, off-centre,
 * stretched fields of exposure and density laid over it, every one reaching
 * well past the page so none of their edges can be found — and the vessel
 * sits in it on a little shade of its own. The memory's colour only
 * contaminates the light (a share of its chroma, more in the denser air,
 * less where the light is strongest); the room stays white-grey.
 *
 * Places are in widths of the page: x 0…1, y 0…height/width.
 */
const LIGHT = {
  /** The ambient base (OKLab lightness) and the paper's faint cool cast (a, b). */
  base: .912,
  cool: [-.0012, -.0046] as const,
  /** Above this lightness the exposure rolls off rather than clipping, up to `ceiling`. */
  shoulder: .935,
  ceiling: .992,
  /** Share of the pick's chroma the light carries everywhere; the fields add to it. */
  tintBase: .045,
  tintMost: .28,
  /** The background is lit at this fraction of the page's size; it has no detail finer than that. */
  lightScale: 1 / 3,
} as const;

/**
 * The wall the light falls on: matte plaster or a heavy paper, not a perfect
 * gradient. Two parts, neither of which adds a hue or moves the fields.
 *
 * Its density, very broad (octaves of `scales` page widths, the domain a little
 * warped so no lattice shows): a few slow changes across the page, ± `light` of
 * lightness everywhere and up to `density` more inside the depth and grounding
 * (their darkening, counted up to `densityAt`), so a denser place is a shade
 * deeper and a breath richer (`chroma`, a share of the colour it already has).
 *
 * Its tooth, at the card's own pixels and laid on the ground alone: three
 * turned octaves of soft noise (`toothPx` px, weighted as the landing's paper)
 * and a very fine static grain, each a standard deviation of `tooth`/`grain`
 * in lightness, as a multiplier so the colour keeps its ratios. Tonal contrast
 * moves both by a tenth either way.
 */
const SURFACE = {
  light: .0065,
  density: .006,
  densityAt: .12,
  chroma: .08,
  scales: [.9, .44, .2] as const,
  warp: .22,
  tooth: .0038,
  toothPx: [1.35, 3.4, 9] as const,
  toothWeights: [.45, .35, .2] as const,
  grain: .0022,
  seed: 0x6e696a6d,
} as const;

/** Tonal contrast: 0 nearly flat, 1 the intended depth, 2 deeper still. */
export const TONAL_CONTRAST = { min: 0, max: 2, standard: 1 } as const;
const TONAL_KEY = "nijimu.memoryImage.tonalContrast";

/** The tonal contrast last set on the image preview, which the download uses too. */
export function readTonalContrast(): number {
  try {
    const kept = Number(localStorage.getItem(TONAL_KEY));
    if (localStorage.getItem(TONAL_KEY) !== null && Number.isFinite(kept)) {
      return Math.min(TONAL_CONTRAST.max, Math.max(TONAL_CONTRAST.min, kept));
    }
  } catch { /* storage unavailable */ }
  return TONAL_CONTRAST.standard;
}

export function keepTonalContrast(value: number) {
  try { localStorage.setItem(TONAL_KEY, String(value)); } catch { /* storage unavailable */ }
}

/** How the contrast scales each kind of field. The light stays where it is;
 *  depth deepens in proportion; the grounding only a little past the standard. */
function roleScale(role: Field["role"], contrast: number): number {
  if (role === "depth") return contrast;
  if (role === "ground") return .25 + .75 * Math.min(1, contrast) + .35 * Math.max(0, contrast - 1);
  return 1;
}

/** Colour kept in the deep fields past the standard contrast: at full boost, the
 *  darkest part of the depth and grounding (`fullAt` of darkening) gains `share`
 *  of the tone's chroma, and the paper's faint cool `cool` more of itself. The
 *  light fields have no darkening, so they stay as pale as they were. Under the
 *  standard the tint thins toward `flatShare` of itself at 0. */
const DEEP_COLOR = { share: .18, cool: .8, fullAt: .16, flatShare: .6 } as const;

/** 0 up to the standard contrast, a breath by 150, at most 1 at 200. */
function deepColorBoost(contrast: number): number {
  const over = Math.min(1, Math.max(0, (contrast - TONAL_CONTRAST.standard) / (TONAL_CONTRAST.max - TONAL_CONTRAST.standard)));
  return Math.pow(over, 1.6);
}

/** One field of light (amount > 0) or density (amount < 0). Sizes are the gaussian's spread. */
type Field = {
  /** What it is in the room, which says how tonal contrast scales it. */
  role: "light" | "depth" | "ground";
  x: number; y: number; sx: number; sy: number;
  /** Turn of its long axis, degrees. */
  turn?: number;
  amount: number;
  /** Share of the pick's chroma it adds where it lies (negative clears it). */
  tint?: number;
  /** How much it clears the paper's cool cast. */
  clear?: number;
};

type Placement = { ox: number; oy: number; fy: number; bodyW: number; aspect: number };

/** The room's light for a vessel standing at `ox`, its middle at `oy`, its foot at `fy`. */
function fieldsFor({ ox, oy, fy, bodyW }: Placement): Field[] {
  return [
    // the exposure: broad light coming in from the upper left, its source well off the page
    { role: "light", x: -.34, y: -.2, sx: 1.02, sy: .8, turn: 34, amount: .08, tint: -.05, clear: .85 },
    // luminous air low and to the left, in front of the vessel
    { role: "light", x: ox - .3, y: fy + .08, sx: .7, sy: .5, turn: -10, amount: .02, tint: -.02, clear: .2 },
    // the depth behind the vessel: an oversized, tilted body of denser air, its
    // deepest part up and to the right of the vessel so the glass's edges read against it
    { role: "depth", x: ox + .2, y: oy - .14, sx: .66, sy: .52, turn: 26, amount: -.088, tint: .12 },
    // the sweep falls away overhead, denser toward the upper right
    { role: "depth", x: ox + .46, y: -.56, sx: 1.25, sy: .66, turn: -9, amount: -.07, tint: .14 },
    // a denser body of air off the right edge, low
    { role: "depth", x: 1.26, y: fy + .02, sx: .55, sy: .85, turn: 18, amount: -.055, tint: .2 },
    // grounding: a wide, soft shade under the vessel, falling away from the light, gone well before the edges
    { role: "ground", x: ox + .07, y: fy + .045, sx: .5, sy: .1, turn: -4, amount: -.028, tint: .16 },
    // the vessel's own shade where it stands
    { role: "ground", x: ox + .018, y: fy + .008, sx: bodyW * .38, sy: .024, amount: -.042, tint: .18 },
    // light reaching across the ground in front of it
    { role: "light", x: ox - .2, y: fy + .17, sx: 1.05, sy: .13, turn: 4, amount: .016, tint: -.02, clear: .3 },
  ];
}

/* ---- small numerics ---- */

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lattice(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0…1. */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed);
  const c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

/** The wall's broad density at (x, y) in page widths: about −1…1, mostly within ±.5. */
function surfaceDensity(x: number, y: number, seed: number): number {
  const [s0, s1, s2] = SURFACE.scales;
  const wx = x + SURFACE.warp * (valueNoise(x / s0 + 3.1, y / s0, seed + 11) - .5);
  const wy = y + SURFACE.warp * (valueNoise(x / s0, y / s0 + 5.7, seed + 13) - .5);
  return (valueNoise(wx / s0, wy / s0, seed + 17) - .5) * 1.5
    + (valueNoise(wx / s1 + 9.2, wy / s1, seed + 19) - .5) * .8
    + (valueNoise(wx / s2, wy / s2 + 1.9, seed + 23) - .5) * .35;
}

/* ---- the wall's tooth ---- */

const toothCache = new Map<string, Float32Array>();

/**
 * The tooth and grain for a page of `w`×`h` px: a zero-mean multiplier offset per
 * pixel. Static (one seed for every card) and kept per size.
 */
export function surfaceTooth(w: number, h: number): Float32Array {
  const key = `${w}x${h}`;
  const hit = toothCache.get(key);
  if (hit) return hit;
  const n = w * h;
  const tooth = new Float32Array(n);
  const [p0, p1, p2] = SURFACE.toothPx;
  const [w0, w1, w2] = SURFACE.toothWeights;
  const seed = SURFACE.seed;
  let sum = 0, sq = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // each octave turned, so none lines up with the pixel grid
      const a = valueNoise(i / p0, j / p0, seed);
      const b = valueNoise((.8 * i - .6 * j) / p1 + 7.7, (.6 * i + .8 * j) / p1, seed + 1);
      const c = valueNoise((.28 * i - .96 * j) / p2, (.96 * i + .28 * j) / p2 + 3.3, seed + 2);
      const t = w0 * a + w1 * b + w2 * c;
      tooth[j * w + i] = t;
      sum += t; sq += t * t;
    }
  }
  const mean = sum / n;
  const toothScale = SURFACE.tooth / Math.max(1e-6, Math.sqrt(Math.max(0, sq / n - mean * mean)));
  // the grain: a triangular draw per pixel (two uniforms), σ of one uniform pair is 1/√6
  const grainScale = SURFACE.grain * Math.sqrt(6);
  for (let k = 0; k < n; k++) {
    const g = lattice(k, 1, seed + 5) + lattice(k, 2, seed + 5) - 1;
    tooth[k] = (tooth[k] - mean) * toothScale + g * grainScale;
  }
  if (toothCache.size >= 2) toothCache.delete(toothCache.keys().next().value as string);
  toothCache.set(key, tooth);
  return tooth;
}

/** Lays the tooth over what is on `ctx` now (the ground alone), in place. */
function wearTooth(ctx: CanvasRenderingContext2D, w: number, h: number, contrast: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const tooth = surfaceTooth(w, h);
  const k = .9 + .1 * contrast;
  for (let i = 0, p = 0; i < tooth.length; i++, p += 4) {
    const f = 1 + tooth[i] * k;
    px[p] = px[p] * f; px[p + 1] = px[p + 1] * f; px[p + 2] = px[p + 2] * f;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---- the light ---- */

/** The background, lit at `LIGHT.lightScale` of the page; it is drawn up to size with smoothing. */
function lightCanvas(w: number, h: number, place: Placement, tone: Oklch | undefined, seed: number, contrast: number): HTMLCanvasElement {
  const lw = Math.max(2, Math.round(w * LIGHT.lightScale));
  const lh = Math.max(2, Math.round(h * LIGHT.lightScale));
  const canvas = document.createElement("canvas");
  canvas.width = lw; canvas.height = lh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image canvas unavailable");
  const img = ctx.createImageData(lw, lh);
  const px = img.data;

  const fields = fieldsFor(place).map(f => {
    const r = ((f.turn ?? 0) * Math.PI) / 180;
    return { ...f, amount: f.amount * roleScale(f.role, contrast), cos: Math.cos(r), sin: Math.sin(r) };
  });
  const hue = ((tone?.h ?? 0) * Math.PI) / 180;
  const chroma = tone?.c ?? 0;
  const ta = Math.cos(hue) * chroma, tb = Math.sin(hue) * chroma;
  const richer = deepColorBoost(contrast);
  // under the standard contrast the flatter room is a paler one too
  const paler = DEEP_COLOR.flatShare + (1 - DEEP_COLOR.flatShare) * Math.min(1, contrast / TONAL_CONTRAST.standard);

  for (let j = 0; j < lh; j++) {
    const y = ((j + .5) / lh) * place.aspect;
    for (let i = 0; i < lw; i++) {
      const x = (i + .5) / lw;
      let L = LIGHT.base, tint = LIGHT.tintBase, clear = 0, dark = 0;
      for (const f of fields) {
        const dx = x - f.x, dy = y - f.y;
        const u = (dx * f.cos + dy * f.sin) / f.sx;
        const v = (-dx * f.sin + dy * f.cos) / f.sy;
        const g = Math.exp(-.5 * (u * u + v * v));
        L += f.amount * g;
        tint += (f.tint ?? 0) * g;
        clear += (f.clear ?? 0) * g;
        if (f.role !== "light") dark -= Math.min(0, f.amount) * g;
      }
      // the wall's density: denser is a shade deeper, more so inside the deep fields
      const dense = surfaceDensity(x, y, seed);
      L -= dense * (SURFACE.light + SURFACE.density * Math.min(1, dark / SURFACE.densityAt));
      if (L > LIGHT.shoulder) {
        const room = LIGHT.ceiling - LIGHT.shoulder;
        L = LIGHT.shoulder + room * (1 - Math.exp(-(L - LIGHT.shoulder) / room));
      }
      // past the standard contrast the deep fields hold their colour as they darken
      const keep = richer * Math.min(1, dark / DEEP_COLOR.fullAt);
      // a denser place holds a breath more of the colour it already has; no hue of its own
      const fuller = 1 + SURFACE.chroma * dense;
      const share = (Math.min(LIGHT.tintMost, Math.max(0, tint)) * paler + DEEP_COLOR.share * keep) * fuller;
      const cool = (1 - Math.min(1, clear)) * (1 + DEEP_COLOR.cool * keep) * fuller;
      const { r, g, b } = oklabToSrgb(L, LIGHT.cool[0] * cool + ta * share, LIGHT.cool[1] * cool + tb * share);
      const k = (j * lw + i) * 4;
      px[k] = r * 255; px[k + 1] = g * 255; px[k + 2] = b * 255; px[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Where the rendered body sits in its frame, as fractions; null when the frame is clear. */
function artifactBounds(artifact: HTMLCanvasElement): { top: number; bottom: number; left: number; right: number } | null {
  const n = 96;
  const probe = document.createElement("canvas");
  probe.width = n; probe.height = n;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(artifact, 0, 0, n, n);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, n, n).data; } catch { return null; }
  let top = n, bottom = -1, left = n, right = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (data[(y * n + x) * 4 + 3] < 24) continue;
    if (y < top) top = y; if (y > bottom) bottom = y;
    if (x < left) left = x; if (x > right) right = x;
  }
  if (bottom < 0) return null;
  return { top: top / n, bottom: (bottom + 1) / n, left: left / n, right: (right + 1) / n };
}

/** Wrap the complete passage, including paragraph breaks and unspaced text. */
export function imageTextLines(text: string, width: number, measure: (text: string) => number, balanceEnd = false): string[] {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const char of word) {
        if (line && measure(line + char) > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
    if (balanceEnd && lines.length > 1) {
      const last = lines.at(-1)!;
      // There are no page breaks in this image. Avoid a stranded word or a
      // very short final line by rebalancing the last two lines per paragraph.
      if (measure(last) < width * .35 || last.trim().split(/\s+/).length === 1) {
        const previous = lines.at(-2)!;
        const spaced = /\s/.test(previous + last);
        const units = spaced ? `${previous} ${last}`.split(/\s+/) : Array.from(previous + last);
        const join = spaced ? " " : "";
        let best: [string, string] | null = null;
        let difference = Infinity;
        for (let split = 2; split <= units.length - 2; split++) {
          const a = units.slice(0, split).join(join), b = units.slice(split).join(join);
          const aw = measure(a), bw = measure(b);
          if (aw <= width && bw <= width && Math.abs(aw - bw) < difference) {
            best = [a, b]; difference = Math.abs(aw - bw);
          }
        }
        if (best) lines.splice(-2, 2, ...best);
      }
    }
    return lines;
  });
}

/** Copy in the renderer's frame, before WebGL clears its drawing buffer. */
export function copyArtifactFrame(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width; copy.height = source.height;
  const context = copy.getContext("2d");
  if (!context) throw new Error("Image canvas unavailable");
  context.drawImage(source, 0, 0);
  return copy;
}

const GRAIN_KEY = "nijimu.memoryImage.grain";

/** The grain the image is printed with — the preview's choice, kept so the download matches it. */
export function readGrainSettings(): GrainSettings {
  try {
    const kept = localStorage.getItem(GRAIN_KEY);
    return grainSettingsOf(kept ? JSON.parse(kept) : null);
  } catch {
    return grainSettingsOf(null);
  }
}

export function keepGrainSettings(settings: GrainSettings) {
  try { localStorage.setItem(GRAIN_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}

export interface MemoryImageOptions {
  tonalContrast?: number;
  grain?: GrainSettings;
}

/** The downloaded image: the card, its grain applied at full size, as a PNG. */
export async function memoryImage(artifact: HTMLCanvasElement, title: string, year: string, transcript: string, tone?: Oklch,
  { tonalContrast, grain }: MemoryImageOptions = {}): Promise<Blob> {
  const canvas = await memoryCard(artifact, title, year, transcript, tone, tonalContrast);
  if (grain && grain.kind !== "off") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image canvas unavailable");
    const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = ctx.createImageData(canvas.width, canvas.height);
    new GrainStudy(source).render(grain, out);
    ctx.putImageData(out, 0, 0);
  }
  return pngOf(canvas);
}

export function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed")), "image/png"));
}

/** The card before any grain: the room, the vessel and the words, at full size. */
export async function memoryCard(artifact: HTMLCanvasElement, title: string, year: string, transcript: string, tone?: Oklch,
  tonalContrast: number = TONAL_CONTRAST.standard): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load(`28px ${SERIF}`),
    document.fonts.load(`32px ${SERIF_CJK}`, "滲む nijimu"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image canvas unavailable");
  ctx.font = `36px ${SERIF}`;
  const titles = imageTextLines(title, 960, text => ctx.measureText(text).width);
  ctx.font = `28px ${SERIF}`;
  const lines = imageTextLines(transcript, 900, text => ctx.measureText(text).width, true);
  const transcriptLineHeight = 40;
  const headerY = 80;
  const headerHeight = 32;
  const titleY = 1190;
  const yearY = titleY + titles.length * 48 + 12;
  const textY = yearY + 100;
  canvas.height = Math.max(1600, textY + lines.length * transcriptLineHeight + 120);
  const w = canvas.width, h = canvas.height;

  // Keep the smaller artifact midway between the header and first title line.
  const artifactSize = 864;
  const artifactX = (w - artifactSize) / 2;
  const artifactY = (headerY + headerHeight + titleY - artifactSize) / 2;
  const bounds = artifactBounds(artifact) ?? { top: .18, bottom: .8, left: .2, right: .8 };
  const place: Placement = {
    ox: (artifactX + ((bounds.left + bounds.right) / 2) * artifactSize) / w,
    oy: (artifactY + ((bounds.top + bounds.bottom) / 2) * artifactSize) / w,
    fy: (artifactY + bounds.bottom * artifactSize) / w,
    bodyW: ((bounds.right - bounds.left) * artifactSize) / w,
    aspect: h / w,
  };
  // One memory, one print: the same light each time it is drawn.
  const seed = hashString(`${title}|${year}|${transcript.length}`);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const contrast = Math.min(TONAL_CONTRAST.max, Math.max(TONAL_CONTRAST.min, tonalContrast));
  ctx.drawImage(lightCanvas(w, h, place, tone, seed, contrast), 0, 0, w, h);
  ctx.restore();
  // the tooth is the wall's, so it goes on before the vessel and the words
  wearTooth(ctx, w, h, contrast);
  ctx.drawImage(artifact, artifactX, artifactY, artifactSize, artifactSize);

  ctx.fillStyle = CHROME_GRAY;
  ctx.textBaseline = "top";
  ctx.font = `32px ${SERIF_CJK}`;
  const jp = ctx.measureText("滲む").width, en = ctx.measureText("nijimu").width, gap = 32;
  ctx.textAlign = "left";
  const logoX = (w - jp - en - gap) / 2;
  ctx.fillText("滲む", logoX, headerY);
  ctx.fillText("nijimu", logoX + jp + gap, headerY);
  ctx.textAlign = "center";
  ctx.font = `36px ${SERIF}`;
  titles.forEach((line, i) => ctx.fillText(line, 600, titleY + i * 48));
  ctx.font = `24px ${SERIF}`;
  ctx.fillText(year, 600, yearY);
  ctx.font = `28px ${SERIF}`;
  lines.forEach((line, i) => ctx.fillText(line, 600, textY + i * transcriptLineHeight));
  return canvas;
}

export function downloadMemoryImage(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nijimu-${title.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "memory"}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  // Downloads can start after the event returns, especially on mobile Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
