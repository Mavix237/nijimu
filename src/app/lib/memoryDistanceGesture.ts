type PalmPoint = { x: number; y: number };

/** Apparent palm size, in video-height units. MediaPipe z is relative to the
 * wrist, not camera depth, so proximity comes from the projected palm instead.
 * Knuckles/wrist determine size; finger spread only gates an open hand. */
export function openPalmSize(hand: readonly PalmPoint[] | undefined, aspect = 1): number | null {
  const required = [0, 5, 9, 13, 17, 6, 8, 10, 12, 14, 16, 18, 20];
  if (!hand || !Number.isFinite(aspect) || aspect <= 0 || required.some(i => {
    const p = hand[i];
    return !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)
      || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1;
  })) return null;
  const distance = (a: number, b: number) => Math.hypot(
    (hand[a].x - hand[b].x) * aspect, hand[a].y - hand[b].y,
  );
  const length = distance(0, 9);
  const width = distance(5, 17);
  if (length < .025 || width / length < .42 || width / length > 1.8) return null;
  const extended = [8, 12, 16, 20].filter(tip =>
    distance(0, tip) > distance(0, tip - 2) + length * .18,
  ).length;
  if (extended < 3) return null;
  return Math.sqrt(width * length);
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Relative push: ~65% growth in palm size travels the full distance range.
 * Reacquisition anchors at the current setting; no entry jump. The anchor moves
 * at the limits so pulling back immediately reverses even after a long push. */
export function createDistancePush() {
  let filtered: number | null = null;
  let applied = 0;
  let lastFrame = 0;
  const reset = () => { filtered = null; };
  return {
    reset,
    update(hand: readonly PalmPoint[] | undefined, aspect: number, now: number, current: number): number | null {
      const size = openPalmSize(hand, aspect);
      if (size === null || !Number.isFinite(now) || !Number.isFinite(current)) { reset(); return null; }
      const signal = Math.log(size) / Math.log(1.65);
      if (filtered === null) {
        filtered = applied = signal;
        lastFrame = now;
        return null;
      }
      const dt = Math.max(0, Math.min(100, now - lastFrame));
      lastFrame = now;
      filtered += (signal - filtered) * (1 - Math.exp(-dt / 150));
      const delta = filtered - applied;
      if (Math.abs(delta) < .006) return null;
      applied = filtered;
      const next = clamp(current + delta);
      return next === current ? null : next;
    },
  };
}
