import { LANDING_MOTION } from "./landingMotion";

/*
 * The landing's captions come and go in small waves: two or three at a time,
 * each typed in a character at a time, held, then taken back from its last
 * character to its first as it dissolves. The next wave begins while the
 * last is still leaving. Every time is drawn when its wave is scheduled, so
 * the plan is a pure function of the clock once drawn.
 */

/* The timings live in LANDING_MOTION.captions so the dev panel can move them;
   read through getters, at the moment each is used. */
const C = LANDING_MOTION.captions;
export const CAPTION_WAVES = {
  /** The first wave, after the landing has painted. */
  get firstAt() { return C.firstAt; },
  /** A typed character, before its own jitter. */
  get perChar() { return C.perChar; },
  charJitter: [0.55, 1.75] as const,
  /** The beat after a space is longer, as a hand pauses between words. */
  get spacePause() { return C.spacePause; },
  /** Members of one wave start within this of each other. */
  get memberJitter() { return C.memberJitter; },
  /** Fully shown, before taking it back. */
  get hold() { return C.hold; },
  get outPerChar() { return C.outPerChar; },
  get inFade() { return C.inFade; },
  get outFade() { return C.outFade; },
  /** The next wave, from the moment the first of this one starts to leave. */
  nextAfterHold: [-350, 1150] as const,
  groupSizes: [2, 3] as const,
} as const;

export interface CaptionShow {
  idx: number;
  /** When each character starts to appear. */
  inAt: number[];
  /** When each character starts to dissolve. */
  outAt: number[];
  end: number;
}

export interface CaptionWaves {
  /** The shows on screen at `now`; schedules any wave that has come due. */
  at(now: number): CaptionShow[];
}

export function createCaptionWaves(
  texts: string[],
  start: number,
  reduced: boolean,
  rand: () => number = Math.random,
): CaptionWaves {
  const W = CAPTION_WAVES;
  const span = (lo: number, hi: number) => lo + (hi - lo) * rand();
  // read when each wave is drawn, so a change in the panel shows from the next wave
  const perCharOf = () => (reduced ? 0 : W.perChar);
  const outPerCharOf = () => (reduced ? 0 : W.outPerChar);
  const inFadeOf = () => (reduced ? 500 : W.inFade);
  const outFadeOf = () => (reduced ? 600 : W.outFade);

  let shows: CaptionShow[] = [];
  let nextAt = start + W.firstAt;
  let bag: number[] = [];
  const busyUntil = texts.map(() => -Infinity);

  const pick = (at: number) => {
    for (let pass = 0; pass < 2; pass++) {
      if (!bag.length) {
        bag = texts.map((_, i) => i);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      const k = bag.findIndex((i) => busyUntil[i] < at);
      if (k >= 0) return bag.splice(k, 1)[0];
      bag = [];
    }
    return null;
  };

  const schedule = (at: number) => {
    const perChar = perCharOf(), outPerChar = outPerCharOf(), inFade = inFadeOf(), outFade = outFadeOf();
    const size = W.groupSizes[Math.floor(rand() * W.groupSizes.length)];
    let firstOut = Infinity;
    for (let m = 0; m < size; m++) {
      const idx = pick(at);
      if (idx === null) break;
      const chars = Array.from(texts[idx]);
      const begin = at + (m === 0 ? 0 : rand() * W.memberJitter);
      const inAt: number[] = [];
      let t = begin;
      for (const ch of chars) {
        inAt.push(t);
        t += perChar * span(...W.charJitter) * (ch === " " ? W.spacePause : 1);
      }
      const outStart = (inAt[inAt.length - 1] ?? begin) + inFade + W.hold;
      const outAt = new Array<number>(chars.length);
      let u = outStart;
      for (let c = chars.length - 1; c >= 0; c--) {
        outAt[c] = u;
        u += outPerChar * span(...W.charJitter);
      }
      const end = (outAt[0] ?? outStart) + outFade;
      busyUntil[idx] = end;
      firstOut = Math.min(firstOut, outStart);
      shows.push({ idx, inAt, outAt, end });
    }
    nextAt = Number.isFinite(firstOut) ? firstOut + span(...W.nextAfterHold) : at + 1000;
  };

  return {
    at(now) {
      while (nextAt <= now) schedule(nextAt);
      shows = shows.filter((s) => s.end > now);
      return shows;
    },
  };
}

/** How present a caption is as a whole at `now`, 0…1: rising as it types in, falling as it dissolves. */
export function captionPresence(show: CaptionShow | undefined, now: number, reduced: boolean) {
  if (!show || !show.inAt.length) return 0;
  const rise = (now - show.inAt[0]) / (reduced ? 500 : 600);
  const leaveFrom = show.outAt[show.outAt.length - 1];
  const fall = (now - leaveFrom) / Math.max(1, show.end - leaveFrom);
  const p = Math.max(0, Math.min(1, rise, 1 - fall));
  return p * p * (3 - 2 * p);
}

/** One character of a show at `now`: how present it is, how diffuse, how far it has drifted. */
export function captionCharLook(show: CaptionShow, c: number, now: number, reduced: boolean) {
  const inT = (now - show.inAt[c]) / (reduced ? 500 : CAPTION_WAVES.inFade);
  if (inT <= 0) return { a: 0, blur: 0, dx: 0, dy: 0 };
  const outT = (now - show.outAt[c]) / (reduced ? 600 : CAPTION_WAVES.outFade);
  if (outT <= 0) {
    const e = 1 - (1 - Math.min(1, inT)) ** 3;
    return { a: e, blur: reduced ? 0 : (1 - e) * C.inBlur, dx: 0, dy: reduced ? 0 : (1 - e) * C.inRise };
  }
  const q = Math.min(1, outT);
  if (reduced) return { a: 1 - q, blur: 0, dx: 0, dy: 0 };
  const seed = Math.sin(show.idx * 91.7 + c * 37.3) * 43758.5453;
  const r = seed - Math.floor(seed);
  const spread = q * q * (3 - 2 * q);
  return {
    a: (1 - q) ** 1.3,
    blur: spread * C.outBlur,
    dx: (r - 0.5) * C.outScatter * spread,
    dy: -(1.5 + r * C.outRise) * spread,
  };
}
