import { useSyncExternalStore } from "react";

/*
 * The naming step's dev knobs (NamingDials, DialKit; development only).
 * PondNamingOverlay reads `useNamingTune()`; without the panel it is
 * NAMING_TUNE_DEFAULT, the step as built. A settling is written back here.
 */

export interface NamingLightTune {
  envAbove: number;
  envBelow: number;
  thickDark: number;
  rim: number;
  highlight: number;
  keyIntensity: number;
}

export interface NamingTune {
  layout: {
    /** The vessel sits this far above the seat the words leave it (vh). */
    artifactLift: number;
    /** × the gallery seat, on this page only. */
    artifactScale: number;
    /** The name, year and transcript rise this far (vh). */
    textLift: number;
    /** Air between the year and the transcript (px). */
    fieldGap: number;
    /** Air between the transcript and the vessel (px). */
    passageGap: number;
  };
  room: { above: string; below: string };
  /** Near & clear. */
  light: NamingLightTune;
  /** Far & faded. */
  lightFar: NamingLightTune;
}

/** The tint fill and the white key. Naming and the card turn these on; other pages leave them at 0. */
export const NAMING_COLOUR_LIGHTS = {
  tintFill: 0.5,
  tintFillSoft: 0.7,
  tintFillChroma: 0.2,
  whiteLight: 0.7,
  whiteSharp: 0.6,
};

export function withNamingLights<T extends object>(tune: T): T & typeof NAMING_COLOUR_LIGHTS {
  return { ...tune, ...NAMING_COLOUR_LIGHTS };
}

export const NAMING_TUNE_DEFAULT: NamingTune = {
  // 2026-11-01: the vessel up 3vh more, so its crown stands over the horizon
  layout: { artifactLift: 6, artifactScale: 1.25, textLift: 6, fieldGap: 28, passageGap: 28 },
  room: { above: "#f3f3ee", below: "#e6e6e6" },
  light: { envAbove: 1.09, envBelow: 1.09, thickDark: 0.06, rim: 0.67, highlight: 1, keyIntensity: 1.41 },
  lightFar: { envAbove: 0.9, envBelow: 1.09, thickDark: 0.06, rim: 0.6, highlight: 1, keyIntensity: 0 },
};

let current: NamingTune = NAMING_TUNE_DEFAULT;
const listeners = new Set<() => void>();

export function setNamingTune(next: NamingTune) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const get = () => current;

/** The current tune; re-renders when the panel changes it. */
export function useNamingTune() {
  return useSyncExternalStore(subscribe, get, get);
}
