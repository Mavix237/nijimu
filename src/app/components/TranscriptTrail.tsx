import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { SERIF } from "../lib/theme";

/*
 * The selected memory's words, let fall behind the pointer.
 *
 * As the pointer moves across the screen (inside a margin: 10vw at the sides,
 * 10vh above, 5vh below) it lets fall the transcript's words in order, one at
 * a time: a word is set down where the pointer is once it has moved clear of
 * the last one, and shows a beat after the pointer has passed — a staggered
 * line of what was said, following the hand. Only the last few stay, the
 * older the fainter; the oldest, when a new one comes, comes apart into grains
 * that drift away from the line and go out. The words are a light grey.
 *
 * The memory's name and year, and the timeline, are blocks the words keep out
 * of: no word is set down on one, or within AVOID_PAD of it.
 */

/** How many of the last words set down stay on the screen. */
const TRAIL = 5;
/** Same face and size as the memory's full transcript under the year. */
const SIZE_VW = 0.9;
const SIZE_MIN = 12;
const SIZE_MAX = 14;
const LETTER_SPACING = 0;
/** Clear space between a word and the next, side by side (em), and their
    least distance one above the other (em, centre to centre). */
const GAP_X_EM = 1.4;
const STEP_Y_EM = 3.6;
/** A word shows this long after the pointer has set it down: the stagger. */
const DELAY_MS = 140;
const IN_MS = 380;
const LIGHT_GRAY = "#c4c4c9";
/** Air kept around what the words avoid, px. */
const AVOID_PAD = { x: 24, y: 14 };

/** The grains a word comes apart into: the sweep across it (s), how fast
    they leave (px/s), how long each lasts once loose (s). */
const SWEEP_S = 0.55;
const GRAIN_SPEED = [14, 46] as const;
const GRAIN_LIFE = [0.7, 1.6] as const;
const GRAIN_LIFT = 1.6;

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

/** One grain of a word coming apart: where it is, how it goes, when it lets go. */
interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds (performance clock) it lets go; until then it holds its place in the word. */
  at: number;
  life: number;
  alpha: number;
  size: number;
  seed: number;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const between = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

/** The word drawn into a canvas the way its span sets it, read back as
    grains: one for every pixel step it covers. `away` is where they go. */
function grainsOf(el: HTMLElement, box: DOMRect, text: string, alpha: number, away: { x: number; y: number }): Grain[] {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height || alpha <= 0.01) return [];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = fontPx();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rect.width * dpr) + 2;
  canvas.height = Math.ceil(rect.height * dpr) + 2;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.scale(dpr, dpr);
  ctx.font = fontOf(px);
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${LETTER_SPACING * px}px`;
  // the span's line box is one em; its baseline sits where CSS puts it, the content area centred on that box
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent ?? px * 0.8;
  const descent = m.fontBoundingBoxDescent ?? px * 0.2;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, (rect.height - (ascent + descent)) / 2 + ascent);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const still = reducedMotion();
  const now = performance.now() / 1000;
  const step = Math.max(1, Math.round(dpr));
  const left = rect.left - box.left;
  const top = rect.top - box.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const reach = Math.abs(away.x) * cx + Math.abs(away.y) * cy || 1;
  const grains: Grain[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const a = data[(y * width + x) * 4 + 3];
      if (a < 40) continue;
      const gx = x / dpr;
      const gy = y / dpr;
      // the end of the word that faces away from the line goes first
      const along = ((gx - cx) * away.x + (gy - cy) * away.y) / reach;
      const speed = between(GRAIN_SPEED);
      grains.push({
        x: left + gx,
        y: top + gy,
        vx: still ? 0 : away.x * speed + (Math.random() - 0.5) * 18,
        vy: still ? 0 : away.y * speed - 8 - Math.random() * 16,
        at: still ? now : now + (1 - (along + 1) / 2) * SWEEP_S + Math.random() * 0.22,
        life: still ? 0.5 : between(GRAIN_LIFE),
        // a touch stronger than the faded word, so its coming apart reads
        alpha: Math.min(1, (a / 255) * alpha * GRAIN_LIFT),
        size: step / dpr,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }
  return grains;
}

const placeStyle = (x: number, y: number): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  transform: "translate(-50%, -50%)",
  fontFamily: SERIF,
  fontSize: `clamp(${SIZE_MIN}px, ${SIZE_VW}vw, ${SIZE_MAX}px)`,
  fontWeight: 400,
  letterSpacing: LETTER_SPACING ? `${LETTER_SPACING}em` : undefined,
  lineHeight: 1,
  whiteSpace: "nowrap",
});

export function TranscriptTrail({ memoryId, transcript, visible, avoid }: {
  memoryId: string;
  transcript: string;
  visible: boolean;
  /** The caption, the timeline: what is drawn in them stays clear of the words. */
  avoid?: RefObject<Element | null>[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  const [trail, setTrail] = useState<Fallen[]>([]);
  const trailNow = useRef<Fallen[]>([]);
  const spans = useRef(new Map<number, HTMLSpanElement>());
  const last = useRef<{ x: number; y: number; width: number } | null>(null);
  /** The next word of the transcript to set down. */
  const next = useRef(0);
  const count = useRef(0);
  const grains = useRef<Grain[]>([]);
  const frame = useRef(0);

  const words = useMemo(() => transcript.split(/[\s.,!?]+/).filter(Boolean), [transcript]);

  /** Draw the loose grains until the last has gone out. */
  const drift = () => {
    cancelAnimationFrame(frame.current);
    let prev = performance.now() / 1000;
    const tick = () => {
      const canvas = sky.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - prev);
      prev = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = LIGHT_GRAY;
      const alive: Grain[] = [];
      for (const g of grains.current) {
        const age = now - g.at;
        if (age > g.life) continue;
        alive.push(g);
        let fade = 1;
        if (age > 0) {
          // loose: it slows as it goes, drifts up a little, and wavers
          const drag = Math.exp(-1.6 * dt);
          g.vx = g.vx * drag + Math.sin(g.seed + age * 5) * 22 * dt;
          g.vy = g.vy * drag - 10 * dt;
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          fade = Math.pow(1 - age / g.life, 1.6);
        }
        ctx.globalAlpha = g.alpha * fade;
        const s = g.size * (age > 0 ? 0.6 + 0.4 * fade : 1);
        ctx.fillRect(g.x, g.y, s, s);
      }
      ctx.globalAlpha = 1;
      grains.current = alive;
      frame.current = alive.length ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // another memory, another set of words: the trail starts over
  useEffect(() => {
    trailNow.current = [];
    setTrail([]);
    last.current = null;
    next.current = 0;
    grains.current = [];
  }, [memoryId]);

  useEffect(() => {
    if (!visible || words.length === 0) return;
    const onMove = (e: PointerEvent) => {
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

      // set down only once the pointer is clear of the last word
      const prev = last.current;
      if (prev) {
        const dx = Math.abs(x - prev.x);
        const dy = Math.abs(y - prev.y);
        if (dx < (prev.width + width) / 2 + GAP_X_EM * px && dy < STEP_Y_EM * px) return;
      }
      const at: Rect = { left: e.clientX - width / 2, top: e.clientY - px, right: e.clientX + width / 2, bottom: e.clientY + px };
      if (avoid?.some((el) => {
        const keepOut = avoidRect(el.current);
        return keepOut && overlaps(at, keepOut);
      })) return;

      next.current = index + 1;
      last.current = { x, y, width };
      const word: Fallen = { key: count.current++, text, x, y, width };
      const all = [...trailNow.current, word];
      const gone = all.slice(0, Math.max(0, all.length - TRAIL));
      trailNow.current = all.slice(-TRAIL);
      // the oldest comes apart before its span goes, read from where it is drawn
      gone.forEach((old, i) => {
        const el = spans.current.get(old.key);
        if (!el) return;
        const toward = all[i + 1] ?? word;
        // away from the line, and a little up
        const dx = old.x - toward.x;
        const dy = old.y - toward.y - 0.5 * Math.hypot(old.x - toward.x, old.y - toward.y);
        const n = Math.hypot(dx, dy) || 1;
        const face = (el.firstElementChild as HTMLElement | null) ?? el;
        const alpha = parseFloat(getComputedStyle(el).opacity) * parseFloat(getComputedStyle(face).opacity);
        grains.current.push(...grainsOf(face, r, old.text, alpha, { x: dx / n, y: dy / n }));
      });
      if (gone.length) drift();
      setTrail(trailNow.current);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, words, avoid]);

  return (
    <div
      ref={box}
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        inset: 0,
        opacity: visible ? 0.8 : 0,
        transition: "opacity 0.8s ease",
      }}
    >
      <style>{`
        @keyframes trailIn {
          from { opacity: 0; filter: blur(2px); }
          to { opacity: 1; filter: blur(0); }
        }
      `}</style>
      <canvas ref={sky} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {trail.map(({ key, text, x, y }, i) => (
        <span
          key={key}
          ref={(el) => {
            if (el) spans.current.set(key, el);
            else spans.current.delete(key);
          }}
          // the older a word in the trail, the fainter
          style={{
            ...placeStyle(x, y),
            color: LIGHT_GRAY,
            opacity: 0.25 + (0.75 * (i + 1)) / trail.length,
            transition: "opacity 0.5s ease",
          }}
        >
          <span style={{ display: "block", animation: `trailIn ${IN_MS}ms ease-out ${DELAY_MS}ms both` }}>{text}</span>
        </span>
      ))}
    </div>
  );
}
