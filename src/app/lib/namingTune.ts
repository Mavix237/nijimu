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
  /** World units over which the water's slope is averaged before it bends the reflection (VesselWaterReflection.smooth). */
  smooth: number;
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
    /** The name and year rise this far (vh; they and the transcript under them rose 6 until the transcript
        left naming, 2026-11-25 — now 3, so the fields come down toward the vessel). */
    textLift: number;
    /** Air between the year and the transcript (px). */
    fieldGap: number;
    /** Air between the transcript and the vessel (px). */
    passageGap: number;
    /** The eye over naming's pond stands this much higher than the pond's own (world units), rising with the
        vessel, which floats higher over its reflection (reflection.gap). */
    cameraLift: number;
    /** The vessel seen from this far above level (degrees; the gallery's 4), as from that higher eye. */
    viewPitch: number;
    /** The eye's look point raised this much (world units, 42 ahead): the view tilts up, so the pond sits lower
        on the screen. */
    lookLift: number;
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
  // the vessel a little higher over the lake, the eye up with it (2026-11-25: cameraLift .5, viewPitch 7 —
  // was the pond's own eye and 4°; reflection.gap .14, was .03)
  // later the same day: the vessel (and its fields, keeping their place over it) 3vh lower — artifactLift 3,
  // textLift 0, were 6 and 3 — and the pond lower still: the view tilted up (lookLift 2.1, ~2.9°, ~6vh)
  // the name and year a little higher over it (textLift 2, was 0; 2026-11-25, later)
  layout: { artifactLift: 3, artifactScale: 1.25, textLift: 2, fieldGap: 20, passageGap: 28, cameraLift: 0.5, viewPitch: 7, lookLift: 2.1 },
  // 2026-11-02: the light above neutral (was #f3f3ee, which lit the glass's top a faint yellow-green;
  // the glass's other light leans a hair cool, so a touch less blue than #f3f3f3 lands neutral)
  room: { above: "#f3f3f1", below: "#e6e6e6" },
  light: { envAbove: 1.09, envBelow: 1.09, thickDark: 0.06, rim: 0.67, highlight: 1, keyIntensity: 1.41 },
  lightFar: { envAbove: 0.9, envBelow: 1.09, thickDark: 0.83, rim: 0.6, highlight: 1, keyIntensity: 0 },
  // 2026-11-01: the vessel mirrored on the lake — bent by the pond's own waves,
  // as strong as the water's Fresnel, lying where the water is
  reflection: {
    // less fractured, breaking with the pond's broad swells (2026-11-25: smooth .3, ripple 1.2, soft 1.8 —
    // was no averaging, 1.66, 1.2); a little more prominent (2026-11-25, later: strength .6, was .46)
    strength: .6, fall: 3.03, gap: .14, soft: 1.8, room: .36,
    smear: .45, ripple: 1.2, stretch: .75, fresnel: .81, smooth: .3,
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
