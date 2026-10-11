import { useEffect, useState, type CSSProperties } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { SERIF } from "../lib/theme";
import { INK_ENTRY, flowProgress } from "../lib/landingTransition";

const INTRO_LINES = ["some memories are never spoken.", "this is a place to let them settle."] as const;

/** Each opening line holds the seat under the wordmark for half of the time
    between the wordmark landing there and the vessels finishing their growth. */
const INTRO_FROM = INK_ENTRY.markEnd;
const INTRO_SPLIT = 4900;
const INTRO_TO = INK_ENTRY.growEnd - 270;
const INTRO_FADE = 520;

const HINT_DELAY_MS = 600;

const LINE_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "16.5vh",
  margin: 0,
  padding: "0 24px",
  textAlign: "center",
  fontFamily: SERIF,
  fontSize: "clamp(14px, 3.2vw, 15px)",
  lineHeight: 1.5,
  color: CHROME_GRAY,
  textWrap: "balance",
  pointerEvents: "none",
};

function lineOpacity(t: number, from: number, to: number) {
  return Math.min(flowProgress(t, from, from + INTRO_FADE), 1 - flowProgress(t, to - INTRO_FADE, to));
}

/** The two opening lines, drawn over the landing while the ink becomes the gallery. */
export function GalleryIntroLines({ elapsed }: { elapsed: number }) {
  const first = lineOpacity(elapsed, INTRO_FROM, INTRO_SPLIT);
  const second = lineOpacity(elapsed, INTRO_SPLIT, INTRO_TO);
  return (
    <div aria-live="polite" style={{ position: "absolute", inset: 0, zIndex: 45, pointerEvents: "none" }}>
      <p style={{ ...LINE_STYLE, opacity: first, filter: `blur(${(1 - first) * 4}px)` }}>{INTRO_LINES[0]}</p>
      <p style={{ ...LINE_STYLE, opacity: second, filter: `blur(${(1 - second) * 4}px)` }}>{INTRO_LINES[1]}</p>
    </div>
  );
}

export function useTouchFirst() {
  const [touch, setTouch] = useState(() => window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  useEffect(() => {
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const change = () => setTouch(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return touch;
}

/** Under the wordmark whenever the rim rests on a memory: how to reach the
    end of the rim, and, at the newest memory, that one more step begins a new one. */
export function GalleryScrollHint({ visible, settled, atNewest, leaving }: {
  /** The gallery's chrome is up (arrival finished, no pond on its way). */
  visible: boolean;
  /** The rim has come to rest on a memory. */
  settled: boolean;
  atNewest: boolean;
  /** The pond is opening. */
  leaving: boolean;
}) {
  const touch = useTouchFirst();
  const text = atNewest
    ? touch ? "swipe once more to begin yours" : "scroll once more to begin yours"
    : touch ? "keep swiping to leave a memory of your own" : "keep scrolling to leave a memory of your own";
  const on = visible && settled && !leaving;
  const [shown, setShown] = useState(text);
  if (on && text !== shown) setShown(text);

  return (
    <p aria-live="polite" style={{ ...LINE_STYLE, zIndex: 31, opacity: on ? 1 : 0,
      filter: on ? "none" : "blur(4px)", transition: `opacity 700ms ease ${on ? HINT_DELAY_MS : 0}ms, filter 700ms ease ${on ? HINT_DELAY_MS : 0}ms` }}>
      <style>{`
        @keyframes galleryHintBreathe { 0%, 100% { opacity: 1; } 50% { opacity: .38; } }
        .gallery-hint-breathe { animation: galleryHintBreathe 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gallery-hint-breathe { animation: none; } }
      `}</style>
      <span className="gallery-hint-breathe">{shown}</span>
    </p>
  );
}
