import { useSyncExternalStore } from "react";
import { LIFE_EVENTS } from "../data/memoryData";
import { oklchToHex, type Oklch } from "./oklch";
import { cssToRgb, rgbToOklch } from "./washColors";
import { GROUND } from "./atmosphere";
import { PAPER_GRAIN } from "./paperFinish";

/*
 * The gallery's dev knobs (GalleryDials, DialKit; development only). With the
 * panel unmounted — every production build — `galleryTune()` is the default:
 * the foot stain and tones below always apply; glass and room only once moved.
 *
 *   foot     the stain each vessel wears from its foot: how strong, its shape
 *            up the glass, how much deeper the foot band is; every pick moved
 *            together (hue, chroma, lightness)
 *   tones    one colour per curated memory — the stain's tone (its feeling) and
 *            the deep band at its very foot
 *   glass    a few of the vessel look's knobs, laid over every vessel (and over
 *            a pushed panel) only once moved off the gallery's own value
 *   room     what the glass reflects and shows through where nothing is behind it
 *   seats    the curve's adjustments: the apex's swell, the two newer seats'
 *            shrink and step out/down
 *   timing   the transcript's dwell, the flight between the views, the parallax
 *   framing  the vessel's width cap in its seat
 *   reflection  a soft mirror image under each vessel: strength, how deep it fades,
 *            its gap under the foot, its blur, the canvas room made for it
 *   sheen    a studio light on the glass: strength, core and rim colours, where on
 *            the screen, size and gradient, how much it keeps to the edge, tilt,
 *            and its drift (speed, how far) and breath
 */

export interface MemoryTone {
  /** The stain's tone: the memory's feeling. */
  stain: string;
  /** The very foot's tone. Empty: drawn from the stain (`foot.deepLight`/`deepChroma`). */
  foot: string;
}

export interface GalleryTune {
  foot: {
    stain: number; depth: number; flash: number;
    footTop: number; footBlend: number; reach: number;
    deepLight: number; deepChroma: number;
    hueShift: number; chroma: number; lightness: number;
    ownFoot: boolean;
  };
  tones: Record<string, MemoryTone>;
  glass: {
    rim: number; thickness: number; bend: number; glassSoft: number; bodyAlpha: number; thickDark: number;
    highlight: number; photoOpacity: number;
  };
  room: { above: string; below: string };
  seats: {
    focusBoost: number;
    shrink1: number; shrink2: number;
    out1: number; out2: number;
    down1: number; down2: number;
  };
  timing: { transcriptDwellMs: number; flightMs: number; staggerMs: number; parallaxX: number; parallaxY: number };
  framing: { maxWidth: number };
  /** The water behind the gallery (the puddle canvas): its still colour, grain, paper fibre, vignette. */
  backdrop: { color: string; grain: number; grainSize: number; paperTexture: number; vignette: number };
  /** A texture laid over the whole gallery (vessels and words too): a noise tile in a blend mode. */
  texture: { amount: number; size: number; contrast: number; blend: string; tint: string; tintAmount: number; tintBlend: string };
  /** A CSS filter over the whole gallery. All neutral = no filter at all. */
  filter: { brightness: number; contrast: number; saturate: number; sepia: number; hue: number; blur: number };
  /** Each vessel mirrored softly under its foot (VesselReflection). */
  reflection: { strength: number; fall: number; gap: number; soft: number; room: number };
  /** A studio sheen on the glass's facing wall (VesselSheen). */
  sheen: {
    amount: number; color: string; edge: string; x: number; y: number;
    size: number; soft: number; rim: number; tilt: number; speed: number; wander: number; breath: number;
  };
}

const toneOf = (ok?: Oklch) => (ok ? oklchToHex(ok) : "#a9b0b4");
const deepOf = (ok: Oklch | undefined, light = .06, chroma = 1.1) =>
  ok ? oklchToHex({ l: Math.max(.2, ok.l - light), c: Math.min(.2, ok.c * chroma), h: ok.h }) : "#8f979c";

/** Each curated memory's stain and foot, by id (settled in the gallery panel, 2026-11-01). */
const GALLERY_TONES: Record<string, MemoryTone> = {
  "0": { stain: "#b38985", foot: "#ccbdb4" }, // 2003 · Born in Beijing
  "1": { stain: "#a0bcbf", foot: "#adc6be" }, // 2009 · First camera
  "2": { stain: "#99b3c2", foot: "#4f6876" }, // 2012 · The first urge to write a story
  "3": { stain: "#c7a8b8", foot: "#b694a6" }, // 2016 · Wanted to be a fashion designer
  "4": { stain: "#6e6085", foot: "#9f879c" }, // 2017 · Read a book that changed my life
  "5": { stain: "#8da2a5", foot: "#7e959e" }, // 2020 · The year everything slowed down
  "6": { stain: "#c39a97", foot: "#99676a" }, // 2021 · Started designing seriously
  "7": { stain: "#97b4b4", foot: "#6a8e96" }, // 2021 · Wrote something true for the first time
  "8": { stain: "#abc1af", foot: "#97af9b" }, // 2022 · Left a place I thought I'd stay longer
  "9": { stain: "#8ca4c2", foot: "#7892b2" }, // 2023 · Started learning to trust my own eye
  "10": { stain: "#7ba5b9", foot: "#6593a9" }, // 2024 · A friendship that quietly ended
  "11": { stain: "#caaeaf", foot: "#b89e89" }, // 2024 · Showed work I wasn't sure about
  "12": { stain: "#bdb9ca", foot: "#aebfc8" }, // 2024 · Met someone through a screen
  "13": { stain: "#8db7bc", foot: "#77a5a8" }, // 2025 · Finding the thread between poetry, film, and design
  "14": { stain: "#d2b1b2", foot: "#c09e98" }, // 2025 · Found my muse
  "15": { stain: "#c49ea9", foot: "#b38a96" }, // 2026 · Still figuring out what love means
};

/** The gallery wears these even with no panel. Its stain is lighter than the
    colour step's and naming's (MEMORY_STAIN .6 / MEMORY_FOOT .62). */
export const GALLERY_TUNE_DEFAULT: GalleryTune = {
  foot: {
    stain: .21, depth: .47, flash: .85,
    footTop: .03, footBlend: .16, reach: .5,
    deepLight: .06, deepChroma: 1.1,
    hueShift: 0, chroma: 1, lightness: 0,
    ownFoot: false,
  },
  tones: Object.fromEntries(LIFE_EVENTS.map((e) => [e.id, GALLERY_TONES[e.id] ?? { stain: toneOf(e.feeling), foot: deepOf(e.feeling) }])),
  // the gallery's own values (VESSEL_GALLERY_TUNE); kept in step by hand
  glass: { rim: .38, thickness: .3, bend: .67, glassSoft: .9, bodyAlpha: .85, thickDark: .21, highlight: .34, photoOpacity: .78 },
  room: { above: "#eae7e6", below: "#ffffff" },
  seats: { focusBoost: .06, shrink1: .13, shrink2: .45, out1: .02, out2: -.025, down1: .045, down2: .05 },
  timing: { transcriptDwellMs: 3000, flightMs: 1500, staggerMs: 55, parallaxX: .03, parallaxY: .02 },
  framing: { maxWidth: 1 },
  // settled in the panel (2026-11-01): warm like the landing's paper, a step under it
  // (was #eae9e9; the landing runs #f4f5f5 → #ecebeb), half the puddle's grain (.07),
  // a little more paper fibre, half the vignette (.16)
  backdrop: { color: GROUND, grain: PAPER_GRAIN, grainSize: 1, paperTexture: 1.3, vignette: .09 },
  // a faint soft-light tooth over everything (settled 2026-11-01); the tint is kept at 0
  texture: { amount: .12, size: 140, contrast: 1, blend: "soft-light", tint: "#e7e5e5", tintAmount: 0, tintBlend: "multiply" },
  filter: { brightness: 1, contrast: 1, saturate: 1, sepia: 0, hue: 0, blur: 0 },
  // a faint, soft mirror under each vessel's foot (settled in the panel, 2026-11-01)
  reflection: { strength: .23, fall: .54, gap: .01, soft: 2.25, room: .25 },
  // a broad soft light high on the left of the facing wall, slowly drifting (settled in the panel, 2026-11-01)
  sheen: {
    amount: .28, color: "#f3f2f2", edge: "#ecf0f0", x: -.45, y: .5,
    size: .34, soft: .74, rim: .1, tilt: -20, speed: .19, wander: .12, breath: .22,
  },
};

/** The gallery's CSS filter, or undefined when every knob is neutral. */
export function galleryFilterCss(f: GalleryTune["filter"]): string | undefined {
  const parts: string[] = [];
  if (f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturate !== 1) parts.push(`saturate(${f.saturate})`);
  if (f.sepia) parts.push(`sepia(${f.sepia})`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

let current: GalleryTune = GALLERY_TUNE_DEFAULT;
let version = 0;
const listeners = new Set<() => void>();

export const galleryTune = () => current;
export const galleryTuneVersion = () => version;

export function setGalleryTune(next: GalleryTune) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  version++;
  colorCache.clear();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Called after every change the panel makes. */
export const subscribeGalleryTune = subscribe;

/** Re-renders when the panel changes anything; returns the version. */
export function useGalleryTuneVersion() {
  return useSyncExternalStore(subscribe, galleryTuneVersion, galleryTuneVersion);
}

const colorCache = new Map<string, Oklch | null>();
function hexToOklch(css: string): Oklch | null {
  if (!css) return null;
  let hit = colorCache.get(css);
  if (hit === undefined) {
    const rgb = cssToRgb(css);
    hit = rgb ? rgbToOklch(rgb) : null;
    colorCache.set(css, hit);
  }
  return hit;
}

function shifted(ok: Oklch, f: GalleryTune["foot"]): Oklch {
  return {
    l: Math.min(.97, Math.max(.15, ok.l + f.lightness)),
    c: Math.max(0, ok.c * f.chroma),
    h: (ok.h + f.hueShift + 360) % 360,
  };
}

/**
 * The colour keys of a gallery vessel's tune: the memory's tone (a curated
 * memory's from the panel, anyone else's from their own pick), moved together
 * by the foot folder, with the stain's strength and shape. No pick, no stain.
 */
export function galleryTint(id: string, pick?: Oklch) {
  const t = current;
  const f = t.foot;
  const tone = t.tones[id];
  const own = tone ? hexToOklch(tone.stain) : null;
  const base = own ?? pick;
  if (!base) {
    return {
      memoryTintHue: 0, memoryTintChroma: 0, memoryTintLight: .66, memoryTintAmount: 0, memoryTintDepth: 0, memoryFlash: 0,
    };
  }
  const ok = shifted(base, f);
  const footOk = f.ownFoot && tone ? hexToOklch(tone.foot) : null;
  const foot = footOk ? shifted(footOk, f) : null;
  return {
    memoryTintHue: ok.h, memoryTintChroma: ok.c, memoryTintLight: ok.l,
    memoryTintAmount: f.stain, memoryTintDepth: f.depth, memoryFlash: f.flash,
    memoryTintFootTop: f.footTop, memoryTintFootBlend: f.footBlend, memoryTintReach: f.reach,
    memoryTintDeepL: f.deepLight, memoryTintDeepC: f.deepChroma,
    ...(foot ? { memoryTintFootLight: foot.l, memoryTintFootChroma: foot.c, memoryTintFootHue: foot.h } : {}),
  };
}

/** The glass knobs moved off their default, to lay over a vessel's own tune. */
export function galleryGlassChanges(): Partial<GalleryTune["glass"]> {
  const out: Partial<GalleryTune["glass"]> = {};
  const d = GALLERY_TUNE_DEFAULT.glass;
  for (const k of Object.keys(d) as (keyof GalleryTune["glass"])[]) {
    if (current.glass[k] !== d[k]) out[k] = current.glass[k];
  }
  return out;
}

/** The room, when moved off the gallery's. */
export function galleryRoomChange(): { above: string; below: string } | null {
  const d = GALLERY_TUNE_DEFAULT.room;
  const r = current.room;
  return r.above !== d.above || r.below !== d.below ? { ...r } : null;
}

/**
 * A gallery vessel's two tones as the glass wears them — the stain and the
 * deep band at its foot (OKLCH) — for anything that paints in a vessel's
 * colour (the landing's ink entry). Null when the memory has no colour.
 */
export function galleryVesselTones(id: string, pick?: Oklch): { stain: Oklch; foot: Oklch } | null {
  const t: Partial<Record<string, number>> = galleryTint(id, pick);
  if (!t.memoryTintAmount) return null;
  const stain = { l: t.memoryTintLight ?? .66, c: t.memoryTintChroma ?? 0, h: t.memoryTintHue ?? 0 };
  const foot = t.memoryTintFootLight !== undefined
    ? { l: t.memoryTintFootLight, c: t.memoryTintFootChroma ?? 0, h: t.memoryTintFootHue ?? 0 }
    : { l: Math.max(.2, stain.l - (t.memoryTintDeepL ?? .06)), c: Math.min(.2, stain.c * (t.memoryTintDeepC ?? 1.1)), h: stain.h };
  return { stain, foot };
}
