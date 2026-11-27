import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { CHROME_GRAY } from "../lib/colors";
import { GALLERY_TEXT_TRACKING, GALLERY_TRANSCRIPT, SERIF, TEXT_ENTER_MS } from "../lib/theme";
import { INK_ENTRY, flowProgress } from "../lib/landingTransition";
import { PAGE_HEADER_MARK } from "./PageHeader";
import { useT } from "../lib/i18n";

/** Each opening line holds the seat under the wordmark for half of the time
    between the wordmark landing there and the vessels finishing their growth. */
const INTRO_FROM = INK_ENTRY.markEnd;
const INTRO_SPLIT = 4900;
const INTRO_TO = INK_ENTRY.growEnd - 270;
const INTRO_FADE = 520;

const HINT_DELAY_MS = 5500;
/** One breath of the tip: full transcript ink, then a dip, and back. */
const HINT_BREATHE_S = 5.4;
/** How far round the tip a pointer or finger makes
    it step aside: its padding, as a trigger zone that blocks nothing (the
    vessels under it stay reachable). */
const HINT_NEAR_PX = 32;

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
  const ui = useT();
  return (
    <div aria-live="polite" style={{ position: "absolute", inset: 0, zIndex: 45, pointerEvents: "none" }}>
      <p style={{ ...LINE_STYLE, opacity: first, filter: `blur(${(1 - first) * 4}px)` }}>{ui.introLine1}</p>
      <p style={{ ...LINE_STYLE, opacity: second, filter: `blur(${(1 - second) * 4}px)` }}>{ui.introLine2}</p>
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
function PlusMark() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" aria-hidden
      style={{ display: "inline-block", verticalAlign: "-0.15em", margin: "0 0.12em" }}>
      <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.75V11.25M4.75 8H11.25" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** A quiet tip's comings and goings: it shows `delayMs` after `ready` (the gallery waits
    HINT_DELAY_MS; none waits not at all), and steps aside while the pointer (or a finger) is within
    HINT_NEAR_PX of its words, coming back once that zone is clear.
    `ref` goes on the tip's paragraph (QuietTip). */
export function useQuietTip(ready: boolean, delayMs = HINT_DELAY_MS) {
  const [rested, setRested] = useState(false);
  const [occupied, setOccupied] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ready) { setRested(false); setOccupied(false); return; }
    if (delayMs <= 0) { setRested(true); return; }
    const t = window.setTimeout(() => setRested(true), delayMs);
    return () => window.clearTimeout(t);
  }, [ready, delayMs]);
  useEffect(() => {
    if (!rested) return;
    let pointer: { x: number; y: number } | null = null;
    const check = () => {
      const words = ref.current?.querySelector(".gallery-hint-breathe")?.getBoundingClientRect();
      if (!words || !words.width) return;
      const left = words.left - HINT_NEAR_PX, right = words.right + HINT_NEAR_PX;
      const top = words.top - HINT_NEAR_PX, bottom = words.bottom + HINT_NEAR_PX;
      const inZone = (r: { left: number; right: number; top: number; bottom: number }) =>
        r.left < right && r.right > left && r.top < bottom && r.bottom > top;
      const near = !!pointer && inZone({ left: pointer.x, right: pointer.x, top: pointer.y, bottom: pointer.y });
      setOccupied(near);
    };
    const move = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; check(); };
    // a finger lifted, or the mouse gone from the window, is no longer there
    const up = (e: PointerEvent) => { if (e.pointerType !== "mouse") { pointer = null; check(); } };
    const out = (e: MouseEvent) => { if (!e.relatedTarget) { pointer = null; check(); } };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("mouseout", out);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("mouseout", out);
    };
  }, [rested]);
  return { ref, on: rested && !occupied };
}

/** The tip itself, under the wordmark: the wordmark's size, the transcript's ink and tracking, a slow
    breath, and a blurred fade in and out. Shared by the gallery's "keep scrolling" and the transcript's
    "click on the transcript to edit". */
export function QuietTip({ on, tipRef, top = "14.5vh", breath = .566, children }: {
  on: boolean; tipRef: RefObject<HTMLParagraphElement | null>;
  /** Where it sits; under the wordmark (the gallery's) unless given. */
  top?: string;
  /** Opacity at the middle of the breath. The gallery dips to .566; the transcript goes clear. */
  breath?: number;
  children: ReactNode;
}) {
  return (
    <p ref={tipRef} className="gallery-scroll-hint" aria-live="polite" style={{ ...LINE_STYLE,
      // a little higher than the landing lines, so a wide short window
      // keeps the vessel clear of the tip
      top,
      // the size of the wordmark just above it
      fontSize: PAGE_HEADER_MARK.fontSize,
      // the transcript's tracking, in proportion to this size
      letterSpacing: GALLERY_TEXT_TRACKING,
      color: GALLERY_TRANSCRIPT.color,
      zIndex: 31, opacity: on ? 1 : 0,
      filter: on ? "none" : "blur(4px)", transition: `opacity ${TEXT_ENTER_MS}ms ease, filter ${TEXT_ENTER_MS}ms ease` }}>
      <style>{`
        @keyframes galleryHintBreathe { 0%, 100% { opacity: 1; } 50% { opacity: var(--hint-breath, .566); } }
        .gallery-hint-breathe { animation: galleryHintBreathe ${HINT_BREATHE_S}s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gallery-hint-breathe { animation: none; } }
      `}</style>
      <span key={breath === 0 ? (on ? "shown" : "hidden") : "steady"} className="gallery-hint-breathe" style={{ ["--hint-breath" as string]: breath }}>{children}</span>
    </p>
  );
}

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
  const ui = useT();
  const kind = atNewest
    ? touch ? "swipe-end" : "scroll-end"
    : touch ? "swipe-mid" : "scroll-mid";
  const { ref, on } = useQuietTip(visible && settled && !leaving);
  const [shown, setShown] = useState(kind);
  if (on && kind !== shown) setShown(kind);
  const copy = shown === "swipe-end" ? ui.tipSwipeEnd
    : shown === "scroll-end" ? ui.tipScrollEnd
    : <>{shown === "swipe-mid" ? ui.tipSwipeMid : ui.tipScrollMid} <PlusMark /><br />{ui.tipMidTail}</>;
  return <QuietTip on={on} tipRef={ref}>{copy}</QuietTip>;
}

/** On the transcript screen once the words can be edited: that a click puts the caret in them. The breath
    runs from full ink to clear on the same clock, starting as soon as the words are there, and keeps
    cycling after they are clicked into. */
export function TranscriptEditHint({ ready, top }: { ready: boolean; top?: string }) {
  const touch = useTouchFirst();
  const ui = useT();
  const { ref, on } = useQuietTip(ready, 0);
  return <QuietTip on={on} tipRef={ref} top={top} breath={0}>{touch ? ui.editTipTap : ui.editTipClick}</QuietTip>;
}
