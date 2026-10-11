import type { ArtifactForm } from "./superformula";

export const RHYTHM_MAX = 16;
export const rhythmValue = (m: number) => Math.round(Math.max(0, Math.min(RHYTHM_MAX, Number.isFinite(m) ? m : 0)) * 4) / 4;

/** The manual edit touches only m in parameter set 2 (the latitude profile). */
export function withRhythm(form: ArtifactForm, m: number): ArtifactForm {
  return { ...form, side: { ...form.side, m: rhythmValue(m) } };
}

/** Thumb–index aperture relative to palm length. Aspect correction keeps
 * landscape video and either mirrored hand equivalent; normalization avoids
 * treating a hand closer to the camera as a wider pinch. Keep the palm facing
 * the camera so the measured aperture is visible. */
export const RHYTHM_PINCH = { closed: .08, open: 1.35, smoothMs: 120, updateMs: 100 } as const;
type PinchPoint = { x: number; y: number };
export function rhythmFromPinch(hand: PinchPoint[], aspect = 1): number | null {
  const points = [hand[0], hand[9], hand[4], hand[8]];
  if (!Number.isFinite(aspect) || aspect <= 0 || points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const distance = (a: PinchPoint, b: PinchPoint) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const palm = distance(hand[0], hand[9]);
  if (palm < .025) return null;
  const aperture = distance(hand[4], hand[8]) / palm;
  return Math.max(0, Math.min(1, (aperture - RHYTHM_PINCH.closed) / (RHYTHM_PINCH.open - RHYTHM_PINCH.closed))) * RHYTHM_MAX;
}

/** Smooth the absolute aperture, then rebuild geometry at most 10 times/sec.
 * Missing landmarks freeze the edit. Reacquisition eases from the held value. */
export function createRhythmPinch() {
  let filtered: number | null = null;
  let lastFrame = 0;
  let lastEdit = 0;
  const reset = () => { filtered = null; };
  return {
    reset,
    update(hand: PinchPoint[], aspect: number, now: number, current: number): number | null {
      const target = rhythmFromPinch(hand, aspect);
      if (target === null || !Number.isFinite(now)) { reset(); return null; }
      if (filtered === null) {
        filtered = rhythmValue(current);
        lastFrame = lastEdit = now;
        return null;
      }
      const dt = Math.max(0, Math.min(100, now - lastFrame));
      lastFrame = now;
      filtered += (target - filtered) * (1 - Math.exp(-dt / RHYTHM_PINCH.smoothMs));
      if (now - lastEdit < RHYTHM_PINCH.updateMs || Math.abs(filtered - current) < .16) return null;
      const next = rhythmValue(filtered);
      if (next === current) return null;
      lastEdit = now;
      return next;
    },
  };
}
