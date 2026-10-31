/** After a gesture has been editing, stay inside `stillBand` for `stillMs`
 *  and the value holds. A later edit needs a sustained move, long enough that
 *  putting a hand down to type cannot reopen it. */

export const GESTURE_HOLD = {
  /** 0–1 of the step's range. Tremor and idle drift sit inside this. */
  stillBand: 0.04,
  stillMs: 520,
  /** Once held, ignore anything inside this band around the lock. */
  breakBand: 0.08,
  /** A hand dropping away to the keyboard must not reopen the form.
      Only a sustained move, held this long, writes again. */
  breakMs: 560,
} as const;

export type HoldResult = {
  /** Value to write, or null to leave the current setting. */
  apply: number | null;
  /** True only on the frame the hold first engages. */
  locked: boolean;
};

export function createGestureHold(tune: Partial<typeof GESTURE_HOLD> = {}) {
  const stillBand = tune.stillBand ?? GESTURE_HOLD.stillBand;
  const stillMs = tune.stillMs ?? GESTURE_HOLD.stillMs;
  const breakBand = tune.breakBand ?? GESTURE_HOLD.breakBand;
  const breakMs = tune.breakMs ?? GESTURE_HOLD.breakMs;

  let engaged = false;
  let held = 0;
  let anchor = 0;
  let armed = false;
  let primed = false;
  let stillSince: number | null = null;
  let breakSince: number | null = null;

  const reset = () => {
    engaged = false;
    armed = false;
    primed = false;
    stillSince = null;
    breakSince = null;
  };

  /** Hands left the frame: keep the lock, forget a half-finished break. */
  const idle = () => {
    breakSince = null;
  };

  /** Slider / key edits move the held value so a later gesture cannot snap back. */
  const sync = (value: number) => {
    if (!Number.isFinite(value)) return;
    held = anchor = value;
  };

  const update = (proposed: number, now: number, current: number): HoldResult => {
    if (!Number.isFinite(proposed) || !Number.isFinite(now) || !Number.isFinite(current)) {
      return { apply: null, locked: false };
    }

    if (!primed) {
      primed = true;
      anchor = current;
      return { apply: null, locked: false };
    }

    if (engaged) {
      if (Math.abs(proposed - held) < breakBand) {
        breakSince = null;
        return { apply: null, locked: false };
      }
      if (breakSince === null) breakSince = now;
      if (now - breakSince < breakMs) return { apply: null, locked: false };
      engaged = false;
      armed = true;
      stillSince = null;
      breakSince = null;
      anchor = proposed;
      return { apply: proposed, locked: false };
    }

    if (Math.abs(proposed - anchor) >= stillBand) {
      armed = true;
      stillSince = null;
      anchor = proposed;
      return { apply: proposed, locked: false };
    }
    if (!armed) return { apply: null, locked: false };
    if (stillSince === null) stillSince = now;
    if (now - stillSince >= stillMs) {
      engaged = true;
      held = current;
      stillSince = null;
      return { apply: null, locked: true };
    }
    return { apply: null, locked: false };
  };

  return {
    reset,
    idle,
    sync,
    update,
    get engaged() { return engaged; },
    get held() { return held; },
  };
}
