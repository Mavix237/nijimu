import { useEffect, useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { DIALS_OPEN } from "../lib/dialsOpen";
import { POND_TUNE_DEFAULT, setPondTune, type PondTune } from "../lib/pondTune";

/*
 * The pond's dev panel (DialKit). Development only: MemoryPondPage imports it
 * lazily behind import.meta.env.DEV, while the pond is the screen in front.
 * Two shells, each draggable:
 *
 *   pond      (bottom right) the water: surface, sun, waves, rings, sphere, sky
 *   pond ink  (bottom left) the pigment: drops, ink, the water's stain
 *
 * Every default is POND_TUNE_DEFAULT (the pond as built, with the sun and
 * the rings' glow settled 2026-11-01). Values persist in localStorage
 * (dialkit:nijimu-pond*); "Copy" in a panel's version menu puts a set on the
 * clipboard to write back into POND_TUNE_DEFAULT (lib/pondTune.ts).
 */

type Range = [number, number, number, number];
type Ranges<T> = { [K in keyof T]?: [number, number, number] };
const D = POND_TUNE_DEFAULT;

/** A folder from a group of defaults: numbers by their range, colours as pickers. */
function folder<T extends object>(defaults: T, ranges: Ranges<T>, collapsed = false) {
  const out: Record<string, unknown> = { _collapsed: collapsed };
  for (const [key, value] of Object.entries(defaults)) {
    const r = ranges[key as keyof T];
    if (typeof value === "string" || typeof value === "boolean") out[key] = value;
    else if (r) out[key] = [value, r[0], r[1], r[2]] as Range;
  }
  return out;
}

const { sun, sunGlow, sunSharp, pathWidth, pathLength, ...surfaceRest } = D.surface;

const WATER_CONFIG = {
  sun: folder({ sun, sunGlow, sunSharp, pathWidth, pathLength }, {
    sun: [0, 2, 0.01], sunGlow: [0, 4, 0.01], sunSharp: [4, 400, 1],
    pathWidth: [0.5, 20, 0.1], pathLength: [2, 60, 0.5],
  }),
  surface: folder(surfaceRest, {
    shade: [0, 1.5, 0.01], clarity: [0, 1, 0.01], sharpness: [0, 3, 0.01], naturalAmount: [0, 2, 0.01],
    hazeFrom: [0, 60, 0.5], hazeRate: [0, 0.06, 0.0005],
    ribbons: [0, 0.1, 0.001], fibres: [0, 0.04, 0.0005], clouds: [0, 0.2, 0.002], grain: [0, 0.06, 0.001],
  }),
  waves: folder(D.waves, {
    swell: [0, 3, 0.01], chop: [0, 3, 0.01], wrinkle: [0.2, 3, 0.01], wind: [0, 4, 0.01],
    holdSpeed: [0.1, 2, 0.01], holdLength: [0.05, 1.5, 0.01], holdHeight: [0, 0.12, 0.001],
    slowPace: [0.1, 1.5, 0.01], press: [0, 2, 0.01],
  }),
  rings: folder(D.rings, { glow: [0, 2, 0.01], shade: [0, 0.6, 0.005], glints: [0, 2, 0.01], bloom: [0, 2, 0.01] }),
  sphere: folder(D.sphere, {
    radius: [0.01, 0.15, 0.001], sit: [-1, 1.5, 0.01], pressed: [-1.5, 1, 0.01],
    glow: [0, 1.5, 0.01], halo: [0, 1, 0.01], reach: [2, 16, 0.1], pressedGlow: [0, 1, 0.01],
  }, true),
  light: folder(D.light, {
    shoulder: [0, 1, 0.01], cap: [0.85, 1, 0.001], warmth: [0, 1.5, 0.01], coolness: [0, 1.5, 0.01], ringWarm: [0, 1, 0.01],
  }),
  sky: folder(D.sky, {
    middleAt: [0.05, 0.95, 0.01], glowAmount: [0, 1, 0.01], glowX: [0, 1, 0.005], glowY: [0, 1, 0.005],
    glowWidth: [0.05, 1.5, 0.01], glowHeight: [0.03, 1, 0.005],
  }),
};

const INK_CONFIG = {
  drops: folder(D.drops, {
    angle: [-80, 80, 1], radius: [0.02, 0.3, 0.001], opacity: [0, 1, 0.01],
    length: [0.8, 6, 0.05], shutter: [0, 0.12, 0.001], sinkS: [0.1, 4, 0.05],
  }),
  ink: folder(D.ink, {
    scale: [0.5, 6, 0.05], hang: [0.3, 4, 0.01], lifeS: [3, 30, 0.5],
    fadeFrom: [0.2, 3, 0.01], fadeTo: [0.3, 4, 0.01],
    strength: [0, 3, 0.01], grain: [0, 6, 0.05], grainPx: [0.2, 3, 0.01],
    clear: [0, 1, 0.01], bend: [0, 8, 0.05], film: [0, 3, 0.01], pale: [0, 1, 0.01],
    lighter: [-0.3, 0.5, 0.005], quieter: [0, 2, 0.01],
  }),
  tone: folder(D.tone, {
    stain: [0, 1, 0.005], reach: [0.05, 1, 0.01], deepUntil: [0.05, 1, 0.01], deep: [0, 1, 0.01],
    delayS: [0, 10, 0.1], crossS: [0.1, 10, 0.1],
  }),
};

type Water = { sun: Partial<PondTune["surface"]>; surface: Partial<PondTune["surface"]> } & Pick<PondTune, "waves" | "rings" | "sphere" | "sky" | "light">;
type Ink = Pick<PondTune, "drops" | "ink" | "tone">;

export default function PondDials() {
  const water = useDialKit("pond", WATER_CONFIG as never, { id: "nijimu-pond-2", persist: true }) as unknown as Water;
  const ink = useDialKit("pond ink", INK_CONFIG as never, { id: "nijimu-pond-ink", persist: true }) as unknown as Ink;

  const key = JSON.stringify([water, ink]);
  const tune = useMemo<PondTune>(() => ({
    sky: { ...D.sky, ...water.sky },
    light: { ...D.light, ...water.light },
    surface: { ...D.surface, ...water.surface, ...water.sun },
    waves: { ...D.waves, ...water.waves },
    rings: { ...D.rings, ...water.rings },
    sphere: { ...D.sphere, ...water.sphere },
    drops: { ...D.drops, ...ink.drops },
    ink: { ...D.ink, ...ink.ink },
    tone: { ...D.tone, ...ink.tone },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);

  useEffect(() => { setPondTune(tune); }, [tune]);

  return (
    <>
      <DialRoot defaultOpen={DIALS_OPEN} position="bottom-right" theme="light" panels={["pond"]} />
      <DialRoot defaultOpen={DIALS_OPEN} position="bottom-left" theme="light" panels={["pond ink"]} />
    </>
  );
}
