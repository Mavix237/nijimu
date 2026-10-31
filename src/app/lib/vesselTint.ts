import type { Oklch } from "./oklch";

/** How strongly the colour stains the glass at its foot. One strength for the
    colour step, naming and the gallery, so the vessel keeps the tint it was given. */
export const MEMORY_STAIN = .36;

/** Feeling is a thin stain rising from the foot of the glass to half its height,
    never an opaque body color — and the colour the vessel's highlights take,
    flashing now and then. */
export function vesselTint(pick?: Oklch) {
  return {
    memoryTintHue: pick?.h ?? 0,
    memoryTintChroma: pick ? Math.max(0, Math.min(.18, pick.c)) * .65 : 0,
    memoryTintAmount: pick ? MEMORY_STAIN : 0,
    memoryFlash: pick ? 1 : 0,
  };
}

/** The tune keys that belong to the memory's colour rather than to a look —
    a look pushed from the lab keeps the memory's own. */
export const MEMORY_COLOR_KEYS = ["memoryTintHue", "memoryTintChroma", "memoryTintAmount", "memoryFlash"] as const;

export function memoryColorOf<T extends Record<(typeof MEMORY_COLOR_KEYS)[number], number>>(tune: T) {
  return Object.fromEntries(MEMORY_COLOR_KEYS.map((k) => [k, tune[k]])) as Pick<T, (typeof MEMORY_COLOR_KEYS)[number]>;
}
