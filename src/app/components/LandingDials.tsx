import { useEffect, useMemo, useRef } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { WASH_KNOBS, initialWashTune, type WashTune } from "../lib/washTune";
import { LANDING_MOTION_DEFAULT, setLandingMotion, type LandingMotion } from "../lib/landingMotion";
import { LANDING_BLENDS, LANDING_LOOK_DEFAULT as L, type LandingLook } from "../lib/landingLook";
import { WASH_COLOR_ADJUST_DEFAULT, WASH_TONE_DEFAULTS, WASH_TONE_NAMES, type WashColors } from "../lib/washColors";

/** The colour panel: every wash together, then one colour per tone slot. */
const COLOR_CONFIG = {
  all: {
    hueShift: [WASH_COLOR_ADJUST_DEFAULT.hueShift, -180, 180, 1],
    chroma: [WASH_COLOR_ADJUST_DEFAULT.chroma, 0, 2.5, 0.01],
    lightness: [WASH_COLOR_ADJUST_DEFAULT.lightness, -0.3, 0.3, 0.005],
    deep: [WASH_COLOR_ADJUST_DEFAULT.deep, 0, 0.3, 0.005],
    opacity: [WASH_COLOR_ADJUST_DEFAULT.opacity, 0, 1.6, 0.01],
  },
  tones: Object.fromEntries(WASH_TONE_NAMES.map((n, i) => [n, WASH_TONE_DEFAULTS[i]])),
};

const R = LANDING_MOTION_DEFAULT.reveal, O = LANDING_MOTION_DEFAULT.opening;
const ORDERS = ["random", "light first", "dark first", "centre out", "edges in", "left to right", "top to bottom"];
const EASES = ["smooth", "bleed", "soak", "linear"];
/** The opening panel: how the washes come in — order, rhythm, growth, shape. Replay to see a change. */
const OPENING_CONFIG = {
  replay: { type: "action" as const },
  order: {
    order: { type: "select" as const, options: ORDERS, default: O.order },
    scatter: [O.scatter, 0, 1, 0.01],
    inViewFirst: [O.inViewFirst, 0, 1, 0.01],
  },
  rhythm: {
    firsts: [O.firsts, 0, 4, 0.1],
    second: [R.second, 0, 3000, 10],
    restFrom: [R.restFrom, 0, 5000, 50],
    lastStart: [R.lastStart, 0, 10000, 50],
    pace: [O.pace, 0.2, 3, 0.05],
    jitter: [R.jitter, 0, 1500, 10],
  },
  growth: {
    ease: { type: "select" as const, options: EASES, default: O.ease },
    growMs: [R.growMs, 300, 10000, 50],
    fadeMs: [R.fadeMs, 100, 8000, 50],
    freeReachFrom: [R.freeReachFrom, 0, 1, 0.01],
    freeGrowLonger: [R.freeGrowLonger, 0, 2, 0.01],
    freeFadeLonger: [R.freeFadeLonger, 0, 3, 0.01],
  },
  shape: {
    roundFrom: [O.roundFrom, 0, 0.9, 0.01],
    openWarp: [O.openWarp, 0, 4, 0.05],
    openDrift: [O.openDrift, 0, 1.5, 0.01],
    wetDeep: [O.wetDeep, 0, 1.5, 0.01],
  },
};

/** The look panel: a filter over the whole landing, a tint, a pool of light. */
const LOOK_CONFIG = {
  filter: {
    brightness: [L.filter.brightness, 0.5, 1.5, 0.01],
    contrast: [L.filter.contrast, 0.5, 1.8, 0.01],
    saturate: [L.filter.saturate, 0, 2.5, 0.01],
    hue: [L.filter.hue, -180, 180, 1],
    sepia: [L.filter.sepia, 0, 1, 0.01],
    blur: [L.filter.blur, 0, 8, 0.1],
  },
  tint: {
    color: L.tint.color,
    amount: [L.tint.amount, 0, 1, 0.01],
    blend: { type: "select" as const, options: LANDING_BLENDS, default: L.tint.blend },
  },
  light: {
    color: L.light.color,
    amount: [L.light.amount, 0, 1, 0.01],
    x: [L.light.x, -0.2, 1.2, 0.01],
    y: [L.light.y, -0.2, 1.2, 0.01],
    size: [L.light.size, 0.05, 1.5, 0.01],
    soft: [L.light.soft, 0, 1, 0.01],
    blend: { type: "select" as const, options: LANDING_BLENDS, default: L.light.blend },
    veil: [L.light.veil, 0, 0.6, 0.005],
  },
};

/*
 * The landing's dev panel (DialKit). Development only: BlobScene imports it
 * lazily behind import.meta.env.DEV, and dialkit/motion are dev dependencies.
 *
 *   look       the WashTune knobs (washes, texture, motion, flow, dots) → the field's uniforms
 *   timing     LANDING_MOTION → the washes' arrival, the edges' follow, Enter's
 *              drift to the gallery, the captions' waves
 *   landing opening (top left) the washes' arrival: order (random, by tone,
 *              by place), rhythm, growth curve, the shape they open with
 *              → LANDING_MOTION.reveal / .opening; "replay" to see it again
 *   landing look  (top left) a CSS filter over the whole landing (brightness,
 *              contrast, saturation, hue, warmth, blur), a tint in a blend mode,
 *              a soft pool of light → LANDING_LOOK_DEFAULT in lib/landingLook.ts
 *   replay     opens the washes and the captions again from nothing
 *
 * Values persist in localStorage (dialkit:nijimu-landing-v2); "Copy" in the
 * panel's version menu puts a set on the clipboard to write back into
 * WASH_TUNE_DEFAULT / LANDING_MOTION.
 */

type Range = [number, number, number, number];

/** [min, max, step] for each timing, around its settled default. */
type TimedGroup = Exclude<keyof LandingMotion, "opening" | "reveal">;
const TIMING_RANGES: { [G in TimedGroup]: { [K in keyof LandingMotion[G]]: [number, number, number] } } = {
  follow: {
    tideEaseMs: [0, 3000, 10],
    maskEaseMs: [0, 2000, 10],
    growRelaxS: [0.05, 3, 0.05],
    entryRelaxS: [0.05, 3, 0.05],
  },
  entry: {
    closeMs: [100, 5000, 50],
    closeSpreadMs: [0, 3000, 50],
    seatDriftMs: [100, 5000, 50],
    seatGather: [0.1, 1.5, 0.01],
    seatFillFrom: [0, 1, 0.01],
  },
  captions: {
    firstAt: [0, 5000, 50],
    perChar: [0, 300, 1],
    spacePause: [1, 5, 0.05],
    memberJitter: [0, 3000, 10],
    hold: [0, 10000, 50],
    outPerChar: [0, 200, 1],
    inFade: [0, 2000, 10],
    outFade: [0, 3000, 10],
    inBlur: [0, 12, 0.1],
    inRise: [0, 12, 0.1],
    outBlur: [0, 30, 0.1],
    outScatter: [0, 40, 0.5],
    outRise: [0, 30, 0.5],
  },
};

const TIMING_FOLDERS: Record<TimedGroup, string> = {
  follow: "edges follow",
  entry: "enter → gallery",
  captions: "captions",
};

function buildConfig(tune: WashTune) {
  const look: Record<string, unknown> = {};
  for (const { group, knobs } of WASH_KNOBS) {
    const folder: Record<string, unknown> = { _collapsed: group === "flow" || group === "dots" };
    for (const k of knobs) folder[k.key] = [tune[k.key], k.min, k.max, k.step] as Range;
    look[group] = folder;
  }
  const timing: Record<string, unknown> = {};
  for (const g of Object.keys(TIMING_RANGES) as TimedGroup[]) {
    const folder: Record<string, unknown> = { _collapsed: true };
    const ranges = TIMING_RANGES[g] as Record<string, [number, number, number]>;
    const defaults = LANDING_MOTION_DEFAULT[g] as Record<string, number>;
    for (const [key, [min, max, step]] of Object.entries(ranges)) folder[key] = [defaults[key], min, max, step] as Range;
    timing[TIMING_FOLDERS[g]] = folder;
  }
  return { replay: { type: "action" as const }, look, timing };
}

export default function LandingDials({
  tune,
  onChange,
  onReplay,
  onColors,
  onLook,
}: {
  tune: WashTune;
  onChange: (t: WashTune) => void;
  onReplay: () => void;
  onColors: (c: WashColors) => void;
  onLook: (l: LandingLook) => void;
}) {
  // the panel's defaults are the landing's opening tune (the built-in under any set saved by the old panel)
  const config = useMemo(() => buildConfig(initialWashTune()), []);
  const replayRef = useRef(onReplay);
  replayRef.current = onReplay;
  const values = useDialKit("landing", config as never, {
    id: "nijimu-landing-v2",
    persist: true,
    onAction: (path: string) => { if (path === "replay") replayRef.current(); },
  }) as unknown as {
    look: Record<string, Record<string, number>>;
    timing: Record<string, Record<string, number>>;
  };

  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lookKey = JSON.stringify(values.look);
  const timingKey = JSON.stringify(values.timing);

  useEffect(() => {
    const next = { ...tuneRef.current };
    let changed = false;
    for (const group of Object.values(values.look)) {
      for (const [k, v] of Object.entries(group)) {
        const key = k as keyof WashTune;
        if (key in next && next[key] !== v) { next[key] = v; changed = true; }
      }
    }
    if (changed) onChangeRef.current(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey]);

  useEffect(() => {
    const next: Partial<Record<keyof LandingMotion, Record<string, number>>> = {};
    for (const g of Object.keys(TIMING_FOLDERS) as TimedGroup[]) {
      const v = values.timing[TIMING_FOLDERS[g]];
      if (v) next[g] = v;
    }
    setLandingMotion(next as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timingKey]);

  const colors = useDialKit("landing colours", COLOR_CONFIG as never, {
    id: "nijimu-landing-colours",
    persist: true,
  }) as unknown as { all: WashColors["adjust"]; tones: Record<string, string> };
  const onColorsRef = useRef(onColors);
  onColorsRef.current = onColors;
  const colorsKey = JSON.stringify(colors);
  useEffect(() => {
    onColorsRef.current({
      tones: WASH_TONE_NAMES.map((n, i) => colors.tones[n] ?? WASH_TONE_DEFAULTS[i]),
      adjust: { ...WASH_COLOR_ADJUST_DEFAULT, ...colors.all },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorsKey]);

  const opening = useDialKit("landing opening", OPENING_CONFIG as never, {
    id: "nijimu-landing-opening",
    persist: true,
    onAction: (path: string) => { if (path === "replay") replayRef.current(); },
  }) as unknown as { order: Record<string, unknown>; rhythm: Record<string, number>; growth: Record<string, unknown>; shape: Record<string, number> };
  const openingKey = JSON.stringify(opening);
  useEffect(() => {
    const { order, rhythm, growth, shape } = opening;
    const { firsts, pace, ...revealRhythm } = rhythm;
    const { ease, ...revealGrowth } = growth;
    setLandingMotion({
      reveal: { ...revealRhythm, ...revealGrowth } as never,
      opening: { ...order, firsts, pace, ease, ...shape } as never,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingKey]);

  const look = useDialKit("landing look", LOOK_CONFIG as never, {
    id: "nijimu-landing-look",
    persist: true,
  }) as unknown as LandingLook;
  const onLookRef = useRef(onLook);
  onLookRef.current = onLook;
  const lookPanelKey = JSON.stringify(look);
  useEffect(() => {
    onLookRef.current({
      filter: { ...L.filter, ...look.filter },
      tint: { ...L.tint, ...look.tint },
      light: { ...L.light, ...look.light },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookPanelKey]);

  return (
    <>
      <DialRoot position="bottom-right" theme="light" panels={["landing", "landing colours"]} />
      <DialRoot position="top-left" theme="light" panels={["landing opening", "landing look"]} />
    </>
  );
}
