import type { ArtifactForm } from "./superformula";

export const RHYTHM_MAX = 16;
export const rhythmValue = (m: number) => Math.round(Math.max(0, Math.min(RHYTHM_MAX, Number.isFinite(m) ? m : 0)) * 4) / 4;

/** Growth=0 masks the formula entirely, so m2 could change while the glass
 * remained a sphere. Reveal its contours on entering Rhythm; retain any
 * stronger shaping. This is saved with the draft, not a preview-only override. */
export const rhythmMorph = (morph: number) => Math.max(.6, Math.min(1, Number.isFinite(morph) ? morph : 0));

/** The manual edit touches only m in parameter set 2 (the latitude profile). */
export function withRhythm(form: ArtifactForm, m: number): ArtifactForm {
  return { ...form, side: { ...form.side, m: rhythmValue(m) } };
}

/** Thumb–index aperture relative to palm length. Aspect correction keeps
 * landscape video and either mirrored hand equivalent; normalization avoids
 * treating a hand closer to the camera as a wider pinch. Keep the palm facing
 * the camera so the measured aperture is visible. */
export const RHYTHM_PINCH = {
  closed: .08, open: 1.35, smoothMs: 160, updateMs: 200,
  settleMs: 200, reverseMs: 300, deadband: .18, maxStep: 2,
} as const;
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

/** Confirm movement for 200ms before editing, with a longer delay on reversal.
 * Confirm direction rather than an exact value so a continuous sweep still
 * updates, at most five times/sec. Missing landmarks discard pending edits. */
export function createRhythmPinch() {
  let filtered: number | null = null;
  let lastFrame = 0;
  let lastEdit = 0;
  let pendingDirection = 0;
  let pendingSince = 0;
  let lastDirection = 0;
  const reset = () => {
    filtered = null;
    pendingDirection = 0;
    lastDirection = 0;
  };
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
      const next = rhythmValue(filtered);
      const direction = Math.sign(filtered - current);
      // Both the live reading and its smoothed value must agree. Otherwise a
      // brief spike could trigger a delayed edit after the fingers settle back.
      if (next === current || Math.abs(filtered - current) < RHYTHM_PINCH.deadband
        || Math.abs(target - current) < RHYTHM_PINCH.deadband || Math.sign(target - current) !== direction) {
        pendingDirection = 0;
        return null;
      }
      if (pendingDirection !== direction) {
        pendingDirection = direction;
        pendingSince = now;
      }
      const delay = lastDirection !== 0 && direction !== lastDirection ? RHYTHM_PINCH.reverseMs : RHYTHM_PINCH.settleMs;
      if (now - pendingSince < delay || now - lastEdit < RHYTHM_PINCH.updateMs) return null;
      lastEdit = now;
      lastDirection = direction;
      pendingDirection = 0;
      // Confirmation must not turn a sustained bad endpoint reading into a
      // full-range jump. The rendered pose separately eases between targets.
      return rhythmValue(current + Math.max(-RHYTHM_PINCH.maxStep, Math.min(RHYTHM_PINCH.maxStep, next - current)));
    },
  };
}
