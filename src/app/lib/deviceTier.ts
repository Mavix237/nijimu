/*
 * How much the device is asked to draw. A phone gets a lighter version of the
 * same scenes: fewer pixels per canvas, lighter multisampling, thinner glass
 * meshes. Decided once at load from the screen's short side and a touch
 * pointer, so turning the phone does not swap quality mid-scene.
 *
 * `?tier=light` or `?tier=full` forces either on any device; `?detail=0.6`
 * sets the vessel mesh detail alone — for comparing the two by eye.
 */

const params = new URLSearchParams(window.location.search);
const forced = params.get("tier");
const shortSide = Math.min(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight);

/** A phone (or a forced light tier). */
export const LIGHT_TIER = forced === "light" ? true : forced === "full" ? false
  : shortSide <= 600 && window.matchMedia("(pointer: coarse)").matches;

/** Highest device-pixel ratio a WebGL canvas renders at. A phone's 3× screen
    at 1.75× is a third of the pixels, under a blur-heavy, low-contrast look. */
export const MAX_DPR = LIGHT_TIER ? 1.75 : 2;

/** Multisampling for the vessel's refraction target. */
export const RT_SAMPLES = LIGHT_TIER ? 2 : 4;

const detailParam = Number(params.get("detail"));
/** Share of the superformula grid a vessel's glass keeps (1 = full). The glass
    is smooth-shaded and seen a few hundred pixels across on a phone. */
export const VESSEL_DETAIL = detailParam > 0 && detailParam <= 1 ? detailParam : LIGHT_TIER ? 0.8 : 1;
