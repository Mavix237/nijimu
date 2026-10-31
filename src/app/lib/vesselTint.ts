import type { Oklch } from "./oklch";

/** How strongly the pick's colour stains the glass just above the deep band. One
    strength for the colour step, naming and the gallery, so the vessel keeps the
    tint it was given. */
export const MEMORY_STAIN = .6;
/** How far the very foot deepens toward the pick's deeper tone, thinning fast above it. */
export const MEMORY_FOOT = .62;

/** Feeling is a stain rising from the foot of the glass to half its height, in
    the colour under the finger itself (the field it is picked from is the
    landing's palette, so every shade between its tones is one too) — and the
    colour the vessel's highlights take, flashing now and then. Read every
    frame, so the glass follows a drag across the field as it moves. */
export function vesselTint(pick?: Oklch) {
  return {
    memoryTintHue: pick?.h ?? 0,
    memoryTintChroma: pick?.c ?? 0,
    memoryTintLight: pick?.l ?? .66,
    memoryTintAmount: pick ? MEMORY_STAIN : 0,
    memoryTintDepth: pick ? MEMORY_FOOT : 0,
    memoryFlash: pick ? 1 : 0,
  };
}

/** The tune keys that belong to the memory's colour rather than to a look —
    a look pushed from the lab keeps the memory's own. */
export const MEMORY_COLOR_KEYS = ["memoryTintHue", "memoryTintChroma", "memoryTintLight", "memoryTintAmount", "memoryTintDepth", "memoryFlash"] as const;

export function memoryColorOf<T extends Record<(typeof MEMORY_COLOR_KEYS)[number], number>>(tune: T) {
  return Object.fromEntries(MEMORY_COLOR_KEYS.map((k) => [k, tune[k]])) as Pick<T, (typeof MEMORY_COLOR_KEYS)[number]>;
}
