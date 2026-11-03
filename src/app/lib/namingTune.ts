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

/** The vessel's reflection on the lake (VesselReflection + its water). */
export interface NamingReflectionTune {
  strength: number; fall: number; gap: number; soft: number; room: number;
  smear: number; ripple: number; stretch: number; fresnel: number;
  tint: number; darken: number;
  /** The landing just under the waterline: its span (share of the canvas), clarity and least strength. */
  contact: number; contactSharp: number; contactStrength: number;
}

/** The memory's colour in the lake round the reflection (lib/namingWater.ts). */
export interface NamingLakeTune {
  /** How much at the centre (0 none). */
  amount: number;
  /** × the pick's chroma for the tint (it only turns the hue). */
  boost: number;
  /** A faint share of it over the lake beyond the ring. */
  wash: number;
  /** The ring's centre below the seat's foot, and its radii, in seat sizes. */
  offsetY: number; radiusX: number; radiusY: number;
  /** How quickly it thins outward. */
  falloff: number;
  /** Degrees from the water's own hue that give nothing, then eased over guardSoft. */
  guard: number; guardSoft: number;
  /** Below this chroma a pick is grey, and gives nothing. */
  minChroma: number;
  /** The landing spot in the foot's tone: how deep, its radii (seat sizes), falloff, how much the waves move it. */
  spot: number; spotRadiusX: number; spotRadiusY: number; spotFalloff: number; spotRipple: number;
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
  reflection: NamingReflectionTune;
  lake: NamingLakeTune;
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
  // 2026-11-02: the light above neutral (was #f3f3ee, which lit the glass's top a faint yellow-green;
  // the glass's other light leans a hair cool, so a touch less blue than #f3f3f3 lands neutral)
  room: { above: "#f3f3f1", below: "#e6e6e6" },
  light: { envAbove: 1.09, envBelow: 1.09, thickDark: 0.06, rim: 0.67, highlight: 1, keyIntensity: 1.41 },
  lightFar: { envAbove: 0.9, envBelow: 1.09, thickDark: 0.83, rim: 0.6, highlight: 1, keyIntensity: 0 },
  // 2026-11-01: the vessel mirrored on the lake — bent by the pond's own waves,
  // as strong as the water's Fresnel, lying where the water is
  reflection: {
    strength: .46, fall: 3.03, gap: .03, soft: 1.2, room: .36,
    smear: .45, ripple: 1.66, stretch: .75, fresnel: .81,
    tint: .41, darken: .02,
    contact: .3, contactSharp: .9, contactStrength: .9,
  },
  // the memory's colour round the reflection, if it is not the water's own blue
  lake: {
    amount: .56, boost: 2.5, wash: .15,
    offsetY: 0, radiusX: .95, radiusY: .35, falloff: 1.4,
    guard: 25, guardSoft: 35, minChroma: .015,
    spot: .35, spotRadiusX: .32, spotRadiusY: .07, spotFalloff: 1.6, spotRipple: .02,
  },
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
