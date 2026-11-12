/*
 * The landing field's knobs: the washes' look, the paint's flow under the
 * pointer, and the memory dots. `WASH_TUNE_DEFAULT` is the built-in settling;
 * "save" in the tune panel keeps one set on this machine, which the landing
 * then opens with. "copy values" writes a set out to paste back here.
 */

export interface WashTune {
  fieldOpacity: number;
  /** How far a wash reaches past its element's half-width. */
  reach: number;
  /** Density at which paint becomes a wash: higher keeps washes apart and smaller. */
  threshold: number;
  /** Higher joins washes only where both are wet. */
  join: number;
  /** How far each wash's outline wanders. */
  warp: number;
  /** How quickly the washes keep changing shape. */
  morph: number;
  fringe: number;
  edge: number;
  /** A wash's tide line while its memory's words are on show. */
  edgeShown: number;
  softness: number;
  grain: number;
  /** Size of the paper's grain inside the washes, in screen pixels. */
  grainPx: number;
  deepTone: number;
  /** 0 is grey, 1 the palette's own colour, above 1 richer. */
  saturation: number;
  /** Field pixels per screen pixel; 1 is the screen's own density. */
  sharpness: number;
  /** How unevenly the ink settles inside a wash (the slow blooms), 0 even. */
  bloom: number;
  /** How quickly those blooms drift, × the settled pace. */
  bloomDrift: number;
  /** A wash's thin interior before its density builds, 0…1. */
  interior: number;
  /** How much the drying edge darkens the pigment. */
  edgeDark: number;
  /** How deeply the paper's tooth cuts the cover (with grain). */
  tooth: number;
  /** How far a free wash is carried along in streaks. */
  streak: number;
  /** How much each wash breathes (stretches) as it changes shape. */
  stretch: number;
  /** How quickly each wash turns as it changes shape. */
  turn: number;
  /** How far a cutout's outline wanders in the ink entry. */
  cutWobble: number;
  /** 0 leaves the free washes smoky and streaked; 1 gives them a round wash's whole body, edge still soft. */
  whole: number;

  /** Open water: how much paper the slow drifting gaps open through the paint, 0 none. */
  gaps: number;
  /** The gaps' size, × 320 px. */
  gapScale: number;
  /** How quickly the gaps drift and change, × a slow liquid pace. */
  gapDrift: number;
  /** After a stroke, how much some places (at random) heal slowly, leaving paper open a while. */
  hold: number;
  /** The size of those slow places, × 260 px. */
  holdScale: number;
  /** The paint's own slow current once stirred, px/s at most. */
  drift: number;
  /** How much a dark wash's edge bleeds into the paint around it, 0 not at all. */
  bleed: number;
  /** How far that bleed reaches, × its halo. */
  bleedReach: number;
  /** A wash counts as dark below this luma (0–1); higher lets mid tones bleed too. */
  bleedTone: number;

  brushPx: number;
  grip: number;
  /** How much clear paper a quick stroke brings into the washes it cuts through. */
  wipe: number;
  curl: number;
  velFadeS: number;
  relaxS: number;
  pressureIters: number;
  simLong: number;
  dyeLong: number;

  dotSize: number;
  dotRestOpacity: number;
  dotRestBlur: number;
}

export const WASH_TUNE_DEFAULT: WashTune = {
  fieldOpacity: 0.85,
  reach: 1.25,
  threshold: 0.18,
  join: 3.3,
  warp: 1,
  morph: 1.75,
  fringe: 0.21,
  edge: 0.56,
  edgeShown: 0.73,
  softness: 1,
  grain: 2.2,
  grainPx: 0.55,
  deepTone: 1,
  saturation: 1.38,
  sharpness: 0.7,
  bloom: 0.49,
  bloomDrift: 2.55,
  interior: 0.22, // was .3: thinner inside, more transparent
  edgeDark: 0.04,
  tooth: 0.28,
  streak: 1.3,
  stretch: 1,
  turn: 0.5,
  cutWobble: 0.06,
  whole: 0.65,

  gaps: 0.4,
  gapScale: 0.8,
  gapDrift: 1,
  hold: 0.65,
  holdScale: 1,
  drift: 6,
  bleed: 0.6,
  bleedReach: 1,
  bleedTone: 0.62,

  brushPx: 38,
  grip: 0.1,
  wipe: 0.45,
  curl: 0,
  velFadeS: 0.7,
  relaxS: 1.6,
  pressureIters: 16,
  simLong: 120,
  dyeLong: 272,

  dotSize: 5.2,
  dotRestOpacity: 0.13,
  dotRestBlur: 1.05,
};

export interface WashKnob {
  key: keyof WashTune;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const WASH_KNOBS: { group: string; knobs: WashKnob[] }[] = [
  {
    group: "washes",
    knobs: [
      { key: "fieldOpacity", label: "field opacity", min: 0, max: 1, step: 0.01 },
      { key: "reach", label: "size (grows from 0)", min: 0.6, max: 2, step: 0.01 },
      { key: "threshold", label: "threshold", min: 0.08, max: 0.7, step: 0.01 },
      { key: "join", label: "join (merged ↔ apart)", min: 1, max: 6, step: 0.1 },
      { key: "warp", label: "outline wander", min: 0, max: 2.5, step: 0.01 },
      { key: "morph", label: "shape change speed", min: 0, max: 4, step: 0.05 },
      { key: "fringe", label: "fringe", min: 0, max: 3, step: 0.01 },
      { key: "edge", label: "tide line", min: 0, max: 3, step: 0.01 },
      { key: "edgeShown", label: "tide line, words shown", min: 0, max: 3, step: 0.01 },
      { key: "softness", label: "edge softness", min: 0.2, max: 3, step: 0.01 },
      { key: "grain", label: "paper grain", min: 0, max: 3, step: 0.01 },
      { key: "grainPx", label: "grain size (px)", min: 0.3, max: 6, step: 0.05 },
      { key: "deepTone", label: "deep tone", min: 0, max: 1, step: 0.01 },
      { key: "saturation", label: "saturation", min: 0, max: 2.5, step: 0.01 },
      { key: "sharpness", label: "sharpness", min: 0.3, max: 1, step: 0.05 },
    ],
  },
  {
    group: "texture",
    knobs: [
      { key: "bloom", label: "ink blooms", min: 0, max: 1.5, step: 0.01 },
      { key: "interior", label: "thin interior", min: 0, max: 1, step: 0.01 },
      { key: "edgeDark", label: "edge darkening", min: 0, max: 0.6, step: 0.01 },
      { key: "tooth", label: "paper tooth depth", min: 0, max: 1, step: 0.01 },
      { key: "streak", label: "streaks (free washes)", min: 0, max: 4, step: 0.05 },
      { key: "cutWobble", label: "cutout edge wander", min: 0, max: 0.2, step: 0.005 },
      { key: "whole", label: "free washes whole", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    group: "open water",
    knobs: [
      { key: "gaps", label: "drifting gaps", min: 0, max: 1, step: 0.01 },
      { key: "gapScale", label: "gap size", min: 0.3, max: 3, step: 0.05 },
      { key: "gapDrift", label: "gap pace", min: 0, max: 4, step: 0.05 },
      { key: "hold", label: "slow-healing places", min: 0, max: 1, step: 0.01 },
      { key: "holdScale", label: "slow place size", min: 0.3, max: 3, step: 0.05 },
      { key: "drift", label: "liquid drift (px/s)", min: 0, max: 30, step: 0.5 },
    ],
  },
  {
    group: "dark bleed",
    knobs: [
      { key: "bleed", label: "dark washes bleed", min: 0, max: 1, step: 0.01 },
      { key: "bleedReach", label: "bleed reach", min: 0.3, max: 3, step: 0.05 },
      { key: "bleedTone", label: "counts as dark below", min: 0.3, max: 0.9, step: 0.01 },
    ],
  },
  {
    group: "motion",
    knobs: [
      { key: "bloomDrift", label: "bloom drift speed", min: 0, max: 6, step: 0.05 },
      { key: "stretch", label: "breathing", min: 0, max: 3, step: 0.01 },
      { key: "turn", label: "turning", min: 0, max: 3, step: 0.01 },
    ],
  },
  {
    group: "flow",
    knobs: [
      { key: "brushPx", label: "brush size (px)", min: 10, max: 200, step: 1 },
      { key: "grip", label: "brush grip", min: 0, max: 1, step: 0.01 },
      { key: "wipe", label: "paper drawn in", min: 0, max: 1, step: 0.01 },
      { key: "curl", label: "eddies", min: 0, max: 60, step: 0.5 },
      { key: "velFadeS", label: "flow lasts (s)", min: 0.1, max: 5, step: 0.05 },
      { key: "relaxS", label: "returns over (s)", min: 0.2, max: 10, step: 0.05 },
      { key: "pressureIters", label: "solver steps", min: 4, max: 60, step: 1 },
      { key: "simLong", label: "flow grid", min: 48, max: 384, step: 8 },
      { key: "dyeLong", label: "paint detail", min: 128, max: 1024, step: 16 },
    ],
  },
  {
    group: "dots",
    knobs: [
      { key: "dotSize", label: "dot size (px)", min: 2, max: 12, step: 0.1 },
      { key: "dotRestOpacity", label: "resting opacity", min: 0, max: 1, step: 0.01 },
      { key: "dotRestBlur", label: "resting blur", min: 0, max: 6, step: 0.05 },
    ],
  },
];

const STORE = "nijimu.landing.wash";

export function loadSavedWashTune(): Partial<WashTune> | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Partial<WashTune>) : null;
  } catch {
    return null;
  }
}

/** The built-in settling under whatever was saved on this machine. */
export function initialWashTune(): WashTune {
  return { ...WASH_TUNE_DEFAULT, ...(loadSavedWashTune() ?? {}) };
}

export function saveWashTune(t: WashTune) {
  try { localStorage.setItem(STORE, JSON.stringify(t)); } catch { /* private mode */ }
}

export function forgetWashTune() {
  try { localStorage.removeItem(STORE); } catch { /* private mode */ }
}
