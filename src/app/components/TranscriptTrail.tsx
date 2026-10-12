import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { GALLERY_TRANSCRIPT, GALLERY_TRANSCRIPT_SIZE, SERIF } from "../lib/theme";

/*
 * The selected memory's words, let fall behind the pointer.
 *
 * As the pointer moves across the screen (inside a margin: 10vw at the sides,
 * 10vh above, 5vh below) it lets fall the transcript's words in order, one at
 * a time: a word is set down where the pointer is once it has moved clear of
 * the last one — by a gap that varies from word to word and closes up when the
 * pointer is slow — and shows a beat after the pointer has passed — a staggered
 * line of what was said, following the hand. Only the last few stay; the
 * oldest, when a new one comes, lingers a moment where it is, then goes out
 * like ink in wet paper: its edges loosen and run, the pigment blooms a little
 * past the letters, and it pales away. The words are set as the full
 * transcript under the year is (GALLERY_TRANSCRIPT), at its full strength.
 *
 * The memory's name and year, and the timeline, are blocks the words keep out
 * of: no word is set down on one, or within AVOID_PAD of it.
 *
 * Once the pointer has travelled REVEAL_PX across the screen with this memory
 * selected, the words that are down leave — each slides down out of its own
 * mask, one after another — and REVEAL_DELAY_MS after the last has gone the
 * gallery is told (`onReveal`), so the whole transcript slides in under the
 * year. Nothing more is let fall until another memory is selected, which
 * starts the count over.
 */

/** How many of the last words set down stay on the screen. */
const TRAIL = 12;
/** How far the pointer travels with a memory selected before its whole transcript is given, px. */
const REVEAL_PX = 2000;
/** One move counts at most this far, so a pointer coming back into the window is not a journey. */
const MOVE_CAP_PX = 200;
/** The words' leaving: each slides down out of its mask over OUT_MS, the next OUT_STAGGER_MS after. */
const OUT_MS = 520;
const OUT_STAGGER_MS = 45;
/** The pause between the last word gone and the full transcript coming in. */
const REVEAL_DELAY_MS = 500;
/** Same face, size and ink as the memory's full transcript under the year (GALLERY_TRANSCRIPT). */
const { vw: SIZE_VW, min: SIZE_MIN, max: SIZE_MAX } = GALLERY_TRANSCRIPT_SIZE;
const LETTER_SPACING = 0;
/** Clear space between a word and the next, side by side (em), and their
    least distance one above the other (em, centre to centre). */
const GAP_X_EM = 1.4;
const STEP_Y_EM = 3.6;
/** The spacing is never stamped: each word draws its own share of it, and a
    slow hand lets the words fall closer — the gap shrinks to SLOW_GAP of
    itself below SLOW_PX_S of pointer speed, full again above FAST_PX_S. The
    product is held to a floor so words never touch. */
const JITTER = [0.72, 1.32] as const;
const SLOW_GAP = 0.6;
const SLOW_PX_S = 120;
const FAST_PX_S = 900;
/** The pointer's speed is eased over about this long, so one quick flick does not decide it. */
const SPEED_EASE_MS = 140;
const GAP_FLOOR = { x: 0.4, y: 0.55 };
/** A word shows this long after the pointer has set it down: the stagger. */
const DELAY_MS = 140;
const IN_MS = 380;
const INK = GALLERY_TRANSCRIPT.color;
/** Air kept around what the words avoid, px. */
const AVOID_PAD = { x: 24, y: 14 };

/** A word let go from the trail stays as it is for LINGER_MS, then washes out
    over WASH_MS: its edges run (WASH_RUN px of displacement through a soft
    noise), the ink spreads (WASH_SPREAD px) and softens (WASH_BLUR px), and it
    blooms a little past its letters as it pales. */
const LINGER_MS = 900;
const WASH_MS = 1700;
const WASH_RUN = 3.5;
const WASH_SPREAD = 0.5;
const WASH_BLUR = 1.5;
const INK_RGB = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16)).join(", ");

type Rect = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** What is drawn in an element — its text and the timeline's strokes — padded.
    The element itself can be the whole screen (the caption's block, the
    timeline's svg), so it is the union of what is drawn in it. */
function avoidRect(el: Element | null): Rect | null {
  if (!el) return null;
  let u: Rect | null = null;
  for (const part of el.querySelectorAll("span, text, line, circle")) {
    // the caption's full transcript is not a block: it is only there once the trail has gone
    if (part.closest("[data-trail-ignore]")) continue;
    const r = part.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    u = u
      ? { left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  return u && {
    left: u.left - AVOID_PAD.x,
    top: u.top - AVOID_PAD.y,
    right: u.right + AVOID_PAD.x,
    bottom: u.bottom + AVOID_PAD.y,
  };
}

const fontPx = () => Math.min(SIZE_MAX, Math.max(SIZE_MIN, (window.innerWidth * SIZE_VW) / 100));
const fontOf = (px: number) => `${px}px ${SERIF}`;

let measure: CanvasRenderingContext2D | null = null;
/** A word's width on screen, px, as the span sets it. */
function textWidth(text: string, px: number): number {
  measure ??= document.createElement("canvas").getContext("2d");
  if (measure) measure.font = fontOf(px);
  return (measure?.measureText(text).width ?? text.length * px * 0.55) + text.length * LETTER_SPACING * px;
}

interface Fallen {
  /** Bumped every word, so the same words set down again draw afresh. */
  key: number;
  text: string;
  /** Its centre, px, in the trail's box. */
  x: number;
  y: number;
  width: number;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const placeStyle = (x: number, y: number): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  transform: "translate(-50%, -50%)",
  ...GALLERY_TRANSCRIPT,
  letterSpacing: LETTER_SPACING ? `${LETTER_SPACING}em` : undefined,
  lineHeight: 1,
  whiteSpace: "nowrap",
});

/** A word washing out: its own filter, whose clock starts when it is drawn, so
    the run and the bleed begin as the linger ends. */
function WashingWord({ word, onGone }: { word: Fallen; onGone: () => void }) {
  const id = `trail-wash-${word.key}`;
  const still = reducedMotion();
  const total = (LINGER_MS + WASH_MS) / 1000;
  const held = LINGER_MS / 1000 / total;
  const ramp = (to: number) => ({ values: `0;0;${to}`, keyTimes: `0;${held.toFixed(3)};1`, dur: `${total}s`, fill: "freeze" as const });
  return (
    <span style={{ ...placeStyle(word.x, word.y), padding: "0.2em 0" }}>
      {!still && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={id} x="-25%" y="-80%" width="150%" height="260%">
            <feMorphology in="SourceGraphic" operator="dilate" radius="0" result="spread">
              <animate attributeName="radius" {...ramp(WASH_SPREAD)} />
            </feMorphology>
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.09" numOctaves="2" seed={word.key % 97} result="paper" />
            <feDisplacementMap in="spread" in2="paper" scale="0" xChannelSelector="R" yChannelSelector="G" result="run">
              <animate attributeName="scale" {...ramp(WASH_RUN)} />
            </feDisplacementMap>
            <feGaussianBlur in="run" stdDeviation="0">
              <animate attributeName="stdDeviation" {...ramp(WASH_BLUR)} />
            </feGaussianBlur>
          </filter>
        </svg>
      )}
      <span
        style={{
          display: "block",
          filter: still ? undefined : `url(#${id})`,
          animation: `${still ? "trailFadeOut" : "trailWash"} ${WASH_MS}ms cubic-bezier(.35, 0, .65, 1) ${LINGER_MS}ms forwards`,
        }}
        onAnimationEnd={onGone}
      >
        {word.text}
      </span>
    </span>
  );
}

export function TranscriptTrail({ memoryId, transcript, visible, avoid, revealed, onReveal }: {
  memoryId: string;
  transcript: string;
  visible: boolean;
  /** The whole transcript is showing: the trail's words leave and no more fall. */
  revealed: boolean;
  /** The pointer has travelled far enough with this memory selected. */
  onReveal: () => void;
  /** The caption, the timeline: what is drawn in them stays clear of the words. */
  avoid?: RefObject<Element | null>[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<Fallen[]>([]);
  const trailNow = useRef<Fallen[]>([]);
  /** Words let go from the trail, lingering and then washing out. */
  const [washing, setWashing] = useState<Fallen[]>([]);
  /** The last word set down, and the share of the gap the next one waits for. */
  const last = useRef<{ x: number; y: number; width: number; jitter: number } | null>(null);
  /** The pointer's eased speed (px/s) and the time of its last move. */
  const speed = useRef({ v: 0, t: 0 });
  /** The next word of the transcript to set down. */
  const next = useRef(0);
  const count = useRef(0);
  /** How far the pointer has travelled with this memory selected, px, and where it was. */
  const travel = useRef(0);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const [leaving, setLeaving] = useState(false);
  /** The journey is done for this memory: the words are leaving, or have gone. */
  const done = useRef(false);
  const revealTimer = useRef(0);

  const words = useMemo(() => transcript.split(/[\s.,!?]+/).filter(Boolean), [transcript]);


  // another memory, another set of words — or the transcript closed: the trail and the count start over
  useEffect(() => {
    if (revealed) return;
    trailNow.current = [];
    setTrail([]);
    setLeaving(false);
    setWashing([]);
    last.current = null;
    next.current = 0;
    travel.current = 0;
    lastPointer.current = null;
    speed.current = { v: 0, t: 0 };
    done.current = false;
    window.clearTimeout(revealTimer.current);
  }, [memoryId, revealed]);
  useEffect(() => () => window.clearTimeout(revealTimer.current), []);

  /** The journey's end: the words go, one after another, the trail empties, and a
      beat later the gallery gives the whole transcript. */
  const finish = () => {
    done.current = true;
    const n = trailNow.current.length;
    if (n > 0) setLeaving(true);
    const gone = n > 0 ? OUT_MS + (n - 1) * OUT_STAGGER_MS : 0;
    revealTimer.current = window.setTimeout(() => {
      trailNow.current = [];
      setTrail([]);
      setLeaving(false);
      revealTimer.current = window.setTimeout(() => reveal.current(), REVEAL_DELAY_MS);
    }, gone);
  };

  useEffect(() => {
    if (!visible || words.length === 0) return;
    const onMove = (e: PointerEvent) => {
      // the words follow a hand on a mouse; a finger dragging the gallery lays none
      if (e.pointerType !== "mouse") return;
      if (revealed || done.current) return;
      // the journey: every move counts, wherever it is on the screen
      const was = lastPointer.current;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const dt = e.timeStamp - speed.current.t;
      if (was && dt > 0 && dt < 500) {
        const v = (Math.hypot(e.clientX - was.x, e.clientY - was.y) / dt) * 1000;
        speed.current.v += (v - speed.current.v) * Math.min(1, dt / SPEED_EASE_MS);
      } else speed.current.v = 0;
      speed.current.t = e.timeStamp;
      if (was) {
        travel.current += Math.min(MOVE_CAP_PX, Math.hypot(e.clientX - was.x, e.clientY - was.y));
        if (travel.current >= REVEAL_PX) {
          finish();
          return;
        }
      }
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const vw = r.width;
      const vh = r.height;
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < vw * 0.1 || x > vw * 0.9 || y < vh * 0.1 || y > vh * 0.95) return;

      const index = next.current % words.length;
      const text = words[index];
      const px = fontPx();
      const width = textWidth(text, px);

      // set down only once the pointer is clear of the last word, by a gap that
      // varies word to word and closes up when the hand is slow
      const prev = last.current;
      if (prev) {
        const dx = Math.abs(x - prev.x);
        const dy = Math.abs(y - prev.y);
        const pace = Math.min(1, Math.max(0, (speed.current.v - SLOW_PX_S) / (FAST_PX_S - SLOW_PX_S)));
        const k = prev.jitter * (SLOW_GAP + (1 - SLOW_GAP) * pace * pace * (3 - 2 * pace));
        const kx = Math.max(GAP_FLOOR.x, k), ky = Math.max(GAP_FLOOR.y, k);
        if (dx < (prev.width + width) / 2 + GAP_X_EM * px * kx && dy < STEP_Y_EM * px * ky) return;
      }
      const at: Rect = { left: e.clientX - width / 2, top: e.clientY - px, right: e.clientX + width / 2, bottom: e.clientY + px };
      if (avoid?.some((el) => {
        const keepOut = avoidRect(el.current);
        return keepOut && overlaps(at, keepOut);
      })) return;

      next.current = index + 1;
      last.current = { x, y, width, jitter: JITTER[0] + Math.random() * (JITTER[1] - JITTER[0]) };
      const word: Fallen = { key: count.current++, text, x, y, width };
      const all = [...trailNow.current, word];
      const gone = all.slice(0, Math.max(0, all.length - TRAIL));
      trailNow.current = all.slice(-TRAIL);
      // the oldest is let go where it is: it lingers, then washes out
      if (gone.length) setWashing((w) => [...w, ...gone]);
      setTrail(trailNow.current);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, words, avoid, revealed]);

  return (
    <div
      ref={box}
      aria-hidden
      data-transcript-trail
      className="absolute pointer-events-none"
      style={{
        inset: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease",
      }}
    >
      <style>{`
        @keyframes trailIn {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: none; }
        }
        @keyframes trailSlideOut {
          from { transform: translateY(0); }
          to { transform: translateY(115%); }
        }
        @keyframes trailFadeOut { to { opacity: 0; } }
        @keyframes trailWash {
          0% { opacity: 1; text-shadow: 0 0 0 rgba(${INK_RGB}, 0); }
          35% { opacity: .8; text-shadow: 0 0 .35em rgba(${INK_RGB}, .5); }
          100% { opacity: 0; letter-spacing: .05em; text-shadow: 0 0 1em rgba(${INK_RGB}, 0); }
        }
      `}</style>
      {washing.map((word) => (
        <WashingWord key={word.key} word={word} onGone={() => setWashing((w) => w.filter((v) => v.key !== word.key))} />
      ))}
      {trail.map(({ key, text, x, y }, i) => (
        <span key={key} style={placeStyle(x, y)}>
          {/* the mask: a word leaves by sliding down out of it */}
          <span style={{ display: "block", overflow: "hidden", padding: "0.2em 0" }}>
            <span data-face style={{
              display: "block",
              animation: leaving
                ? `${reducedMotion() ? "trailFadeOut" : "trailSlideOut"} ${OUT_MS}ms cubic-bezier(.55, 0, .75, .2) ${i * OUT_STAGGER_MS}ms both`
                : `trailIn ${IN_MS}ms ease-out ${DELAY_MS}ms both`,
            }}>{text}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
