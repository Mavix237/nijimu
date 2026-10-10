import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { SANS } from "../lib/theme";

/*
 * The selected memory's words, hidden in a grid behind it.
 *
 * The screen, inside a margin (10vw at the sides, 10vh above, 5vh below), is
 * 16 cells across and 9 down; each cell holds one word of the transcript, in
 * order down each column and then on to the next, starting over when the words
 * run out. A cell shows its word only once the pointer has passed over it, and
 * only the last few cells passed over keep theirs — a short trail of what was
 * said, following the hand. The words are a light grey.
 *
 * The words the memory's highlight step lifted out are italic and underlined,
 * in the darker ink of the memory's name in the caption, and are not part of the trail's fading: once
 * found, one holds at full ink for a while after the trail has moved on, then
 * washes out — it bleeds and spreads like ink let go in water. A highlight can
 * be a run of words ("orange peels"): finding any of its words writes the
 * whole phrase on one line, in the cell where it begins.
 *
 * The memory's name and year, and the timeline, are blocks the words keep out
 * of: a cell whose word would land on one, or within AVOID_PAD of it, is
 * passed over.
 */

const COLS = 16;
const ROWS = 9;
/** How many of the last words visited stay on the screen. */
const TRAIL = 5;
/** The words' size follows the screen's height: SIZE_VH of it, held between SIZE_MIN and SIZE_MAX px. */
const SIZE_VH = 1.2;
const SIZE_MIN = 8;
const SIZE_MAX = 12;
const SIZE = `clamp(${SIZE_MIN}px, ${SIZE_VH}vh, ${SIZE_MAX}px)`;
/** The trail's own words; a highlighted one is CHROME_GRAY, the caption title's. */
const LIGHT_GRAY = "#ababb2";
/** A highlighted word: how long it holds after it is found, then how long it washes out. */
const INK_HOLD_MS = 2400;
const INK_WASH_MS = 1800;
/** Air kept around what the words avoid, px. */
const AVOID_PAD = { x: 24, y: 14 };

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

let measure: CanvasRenderingContext2D | null = null;
/** Where a word in a cell is drawn, on screen: SIZE and the span's padding, worked out here. */
function wordRect(cell: number, word: string, grid: DOMRect): Rect {
  const px = Math.min(SIZE_MAX, Math.max(SIZE_MIN, (window.innerHeight * SIZE_VH) / 100));
  measure ??= document.createElement("canvas").getContext("2d");
  if (measure) measure.font = `${px}px ${SANS}`;
  // the ink wash spreads a word by about a fifth as it goes
  const width = ((measure?.measureText(word).width ?? word.length * px * 0.55) + word.length * 0.02 * px) * 1.2;
  const left = grid.left + (Math.floor(cell / ROWS) / COLS) * grid.width;
  const top = grid.top + ((cell % ROWS) / ROWS) * grid.height;
  return { left, top, right: left + width + 1.2 * px, bottom: top + 1.8 * px };
}

/** A word as the highlight step and the trail both see it: no case, no
    punctuation, so "Summer." in a saved highlight finds "summer" here. */
const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

interface Visit {
  /** The cell, col * ROWS + row, which is also the word's place in the grid. */
  cell: number;
  /** Bumped every visit, so leaving a cell and coming back shows it again. */
  key: number;
}

/** A highlighted phrase found: written whole in the cell where it begins. */
interface Inked extends Visit {
  text: string;
}

/** Where a highlighted word's phrase begins in the transcript, and how many words it runs. */
type PhraseAt = { start: number; length: number } | null;

const wordStyle = (cell: number): CSSProperties => ({
  position: "absolute",
  left: `${(Math.floor(cell / ROWS) / COLS) * 100}%`,
  top: `${((cell % ROWS) / ROWS) * 100}%`,
  padding: "0.4em 0.6em",
  fontFamily: SANS,
  fontSize: SIZE,
  letterSpacing: "0.02em",
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: CHROME_GRAY,
});

export function TranscriptTrail({ memoryId, transcript, highlightedWords, visible, avoid }: {
  memoryId: string;
  transcript: string;
  highlightedWords: string[];
  visible: boolean;
  /** The caption, the timeline: what is drawn in them stays clear of the words. */
  avoid?: RefObject<Element | null>[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<Visit[]>([]);
  /** Highlighted words found, each on its own clock until it has washed out. */
  const [inked, setInked] = useState<Inked[]>([]);
  const last = useRef<number | null>(null);
  const count = useRef(0);

  const words = useMemo(() => transcript.split(/[\s.,!?]+/).filter(Boolean), [transcript]);
  /** Each word's highlighted phrase, found wherever its words run in order;
      where two overlap ("light", "color of the light") the longer holds. */
  const phrases = useMemo(() => {
    const at: PhraseAt[] = words.map(() => null);
    const plain = words.map(bare);
    for (const highlight of highlightedWords) {
      const parts = highlight.split(/[\s.,!?]+/).map(bare).filter(Boolean);
      if (parts.length === 0) continue;
      for (let start = 0; start + parts.length <= words.length; start++) {
        if (!parts.every((part, k) => plain[start + k] === part)) continue;
        for (let k = 0; k < parts.length; k++) {
          if ((at[start + k]?.length ?? 0) < parts.length) at[start + k] = { start, length: parts.length };
        }
      }
    }
    return at;
  }, [words, highlightedWords]);
  const lifted = (cell: number) => phrases[cell % words.length] !== null;

  // another memory, another set of words: the trail starts over
  useEffect(() => {
    setTrail([]);
    setInked([]);
    last.current = null;
  }, [memoryId]);

  useEffect(() => {
    if (!visible || words.length === 0) return;
    const onMove = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const col = Math.floor(((e.clientX - r.left) / r.width) * COLS);
      const row = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const cell = col * ROWS + row;
      if (cell === last.current) return;
      last.current = cell;
      const blocked = (at: Rect) => !!avoid?.some((el) => {
        const keepOut = avoidRect(el.current);
        return keepOut && overlaps(at, keepOut);
      });
      if (blocked(wordRect(cell, words[cell % words.length], r))) return;
      const visit = { cell, key: count.current++ };
      // a cell come back to moves to the head of the trail rather than drawing twice
      setTrail((t) => [...t.filter((v) => v.cell !== cell), visit].slice(-TRAIL));
      const phrase = phrases[cell % words.length];
      if (phrase) {
        const text = words.slice(phrase.start, phrase.start + phrase.length).join(" ");
        // the phrase is written where it begins; where that is kept out, at its first word that is not
        const begins = cell - (cell % words.length - phrase.start);
        let anchor: number | null = null;
        for (let at = begins; at < begins + phrase.length && anchor === null; at++) {
          if (!blocked(wordRect(at, text, r))) anchor = at;
        }
        // found again before it has washed out: it starts its hold over
        if (anchor !== null) {
          setInked((k) => [...k.filter((v) => v.cell !== anchor), { cell: anchor, key: visit.key, text }]);
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [visible, words, phrases, avoid]);

  return (
    <div
      ref={box}
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        left: "10vw",
        right: "10vw",
        top: "10vh",
        bottom: "5vh",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.8s ease",
      }}
    >
      <style>{`
        @keyframes trailInkWash {
          0% { opacity: 1; filter: blur(0); letter-spacing: 0.02em; transform: scale(1); text-shadow: 0 0 0 rgba(126, 126, 134, 0); }
          35% { opacity: 0.8; filter: blur(0.8px); text-shadow: 0 0 6px rgba(126, 126, 134, 0.55); }
          100% { opacity: 0; filter: blur(7px); letter-spacing: 0.14em; transform: scale(1.12); text-shadow: 0 0 20px rgba(126, 126, 134, 0); }
        }
        @keyframes trailInkFade { to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .trail-ink { animation-name: trailInkFade !important; }
        }
      `}</style>
      {words.length > 0 && trail.map(({ cell, key }, i) =>
        // a highlighted word is drawn from its own clock below, not the trail's
        lifted(cell) ? null : (
          <span
            key={key}
            // the older a word in the trail, the fainter
            style={{ ...wordStyle(cell), color: LIGHT_GRAY, opacity: (i + 1) / trail.length }}
          >
            {words[cell % words.length]}
          </span>
        ),
      )}
      {words.length > 0 && inked.map(({ cell, key, text }) => (
        <span
          key={key}
          className="trail-ink"
          style={{
            ...wordStyle(cell),
            fontStyle: "italic",
            textDecoration: "underline",
            textDecorationThickness: "0.06em",
            textUnderlineOffset: "0.2em",
            transformOrigin: "left center",
            animation: `trailInkWash ${INK_WASH_MS}ms ease-in ${INK_HOLD_MS}ms forwards`,
          }}
          onAnimationEnd={() => setInked((k) => k.filter((v) => v.key !== key))}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
