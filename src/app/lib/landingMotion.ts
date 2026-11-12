/*
 * The landing's timings, as one mutable object read where each is used, so the
 * dev DialKit panel (`LandingDials`) can move them live. The defaults are the
 * values the landing was settled with; nothing writes here outside the panel.
 */

export const LANDING_MOTION = {
  /** The washes arriving one after another (WatercolorField). */
  reveal: {
    /** The second wash in view, after the first (ms). */
    second: 650,
    /** The rest begin from here (ms)… */
    restFrom: 1500,
    /** …the last at this (ms), at a quickening pace. */
    lastStart: 3800,
    jitter: 200,
    /** A round wash grows over this (ms). */
    growMs: 3300,
    /** …and fades in over this (ms). */
    fadeMs: 2000,
    /** A free, streaked wash starts at this share of its size… */
    freeReachFrom: 0.72,
    /** …grows this much longer, and fades this much longer. */
    freeGrowLonger: 0.35,
    freeFadeLonger: 0.9,
    /** The share of the opening after which the centre copy and Enter come in, and the
        captions after them (WatercolorField's onSettling). Was .8 (~6.8 s); 2026-11-11. */
    copyAt: 0.45,
  },
  /** How the opening washes come in: their order, rhythm, curve and shape (WatercolorField). */
  opening: {
    /** random | light first | dark first | centre out | edges in | left to right | top to bottom */
    order: "random",
    /** 0 follows the order exactly, 1 is wholly random. */
    scatter: 0.25,
    /** How strongly what is in view comes before what is off it (0 none). */
    inViewFirst: 0.35,
    /** How many come alone before the rest (a fraction is a chance of one more). */
    firsts: 1.5,
    /** The rest's spacing: <1 quickens toward the end, 1 even, >1 slows. */
    pace: 0.8,
    /** smooth (still at both ends) | bleed (fast, then a long settle) | soak (quick, then very long) | linear */
    ease: "smooth",
    /** A round wash starts at this share of its size (0 opens from a point). */
    roundFrom: 0,
    /** Its edge wanders this much more while it opens, settling as it reaches its size. */
    openWarp: 0,
    /** It opens from a point this far off its centre (× its radius) and flows over. */
    openDrift: 0,
    /** Wet paint is deeper: extra density while it opens, drying paler. */
    wetDeep: 0,
  },
  /** How the paint and the edges follow (WatercolorField). */
  follow: {
    /** The tide line follows its caption this far behind (ms). */
    tideEaseMs: 450,
    /** A late cutout outline eases in over this (ms). */
    maskEaseMs: 350,
    /** While the washes open, stirred paint returns this quickly (s). */
    growRelaxS: 0.3,
    /** Through the ink entry, the paint returns this quickly (s). */
    entryRelaxS: 0.3,
  },
  /** Enter → gallery: washes close or drift onto their vessel seats (BlobScene). */
  entry: {
    closeMs: 1400,
    closeSpreadMs: 600,
    seatDriftMs: 1500,
    /** The share of its outline's box a wash arrives at: a little inside the
     *  outline, so it grows out into it rather than shrinking to a patch first. */
    arriveAs: 0.7,
    /** How far into its drift a wash begins to take its vessel's shape: it
     *  spreads out to the outline first (formMs), then the paint fills it. */
    morphFrom: 0.7,
    /** How long the wash takes to spread out and draw the outline (ms). */
    formMs: 1000,
    /** The share of the box the wash swells to as it spreads into the outline. */
    swellTo: 1,
  },
  /** The captions' waves (captionWaves). */
  captions: {
    firstAt: 700,
    perChar: 64,
    spacePause: 1.9,
    memberJitter: 520,
    hold: 3000,
    outPerChar: 30,
    inFade: 280,
    outFade: 820,
    /** A character's blur and rise as it types in (px). */
    inBlur: 2.4,
    inRise: 1.5,
    /** As it dissolves: blur, sideways scatter and rise (px). */
    outBlur: 7.5,
    outScatter: 7,
    outRise: 4,
  },
};

export type LandingMotion = typeof LANDING_MOTION;

/** A deep copy of the settled values, for the panel's defaults. */
export const LANDING_MOTION_DEFAULT: LandingMotion = JSON.parse(JSON.stringify(LANDING_MOTION));

/** Writes a (partial) set into the live object, group by group. */
export function setLandingMotion(next: { [G in keyof LandingMotion]?: Partial<LandingMotion[G]> }) {
  for (const g of Object.keys(next) as (keyof LandingMotion)[]) {
    Object.assign(LANDING_MOTION[g], next[g]);
  }
}
