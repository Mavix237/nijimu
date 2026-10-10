import type { ArtifactForm } from "./superformula";

export const RHYTHM_MAX = 16;
export const rhythmValue = (m: number) => Math.round(Math.max(0, Math.min(RHYTHM_MAX, Number.isFinite(m) ? m : 0)) * 4) / 4;

/** The manual edit touches only m in parameter set 2 (the latitude profile). */
export function withRhythm(form: ArtifactForm, m: number): ArtifactForm {
  return { ...form, side: { ...form.side, m: rhythmValue(m) } };
}

/** Roll of the wrist-to-middle-knuckle axis in the mirrored camera view.
 * A relative dial supports either hand without a jump on acquisition. */
export function palmRoll(hand: { x: number; y: number }[], aspect = 1): number | null {
  if (!hand[0] || !hand[9]) return null;
  const x = (hand[0].x - hand[9].x) * aspect;
  const y = hand[0].y - hand[9].y;
  return Math.hypot(x, y) < .025 ? null : Math.atan2(x, y);
}
export function rhythmFromRoll(start: number, angle: number, origin: number): number {
  const delta = Math.atan2(Math.sin(angle - origin), Math.cos(angle - origin));
  return rhythmValue(start + delta / (Math.PI / 2) * 8);
}
