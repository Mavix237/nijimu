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
  edgeShown: 1.5,
  softness: 1,
  grain: 2.2,
  grainPx: 0.8,
  deepTone: 1,
  saturation: 1.38,
  sharpness: 0.7,

  brushPx: 52,
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
      { key: "grainPx", label: "grain size (px)", min: 0.6, max: 6, step: 0.1 },
      { key: "deepTone", label: "deep tone", min: 0, max: 1, step: 0.01 },
      { key: "saturation", label: "saturation", min: 0, max: 2.5, step: 0.01 },
      { key: "sharpness", label: "sharpness", min: 0.3, max: 1, step: 0.05 },
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
