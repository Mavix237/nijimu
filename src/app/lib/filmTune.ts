import { useSyncExternalStore } from "react";

/*
 * The photo's film look on every vessel (descent, naming, gallery), as the
 * "vessel film" DialKit panel tunes it (development only). `lookFor` in
 * VesselPreview reads it. Neutral defaults: the look as built, so nothing
 * changes until a knob moves; a settling is written back here.
 *
 *   leak      × the tune's light leak (dyeLeak): the orange-cream lobe from
 *             one side and its hot spot — on the upright strip, above or
 *             below the picture
 *   cool      how much of the film's warmth goes: cream highlights, cream
 *             bloom, orange halation, the leak's colour (0 as built, 1 neutral)
 *   halation  the orange fringe round the brights
 *   split     the crossover: cool, dull shadows and cream highlights
 *   bloom     × the glow from the brights
 */
export interface FilmTune { leak: number; cool: number; halation: number; split: number; bloom: number }

// halation .16 from the gallery panel, 2026-11-10 (was .1)
export const FILM_TUNE_DEFAULT: FilmTune = { leak: 1, cool: 0, halation: .16, split: .6, bloom: 1 };

let current: FilmTune = FILM_TUNE_DEFAULT;
const listeners = new Set<() => void>();
export const filmTune = () => current;
export function setFilmTune(next: FilmTune) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useFilmTune() { return useSyncExternalStore(subscribe, filmTune, filmTune); }
