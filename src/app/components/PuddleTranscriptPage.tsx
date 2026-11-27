import { FLOW_PAGE } from "../lib/theme";
import { SAMPLE_TRANSCRIPT } from "../data/sampleMemory";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { CHROME_GRAY } from "../lib/colors";
import { DESCENT_PATH, RECORD_START_PATH, TRANSCRIPT_PATH } from "../lib/routes";
import { NOTE_SIZE, SERIF, TRANSCRIPT, TRANSCRIPT_WIDTH } from "../lib/theme";
import { getTranscription } from "../lib/transcribe";
import type { ArtifactForm } from "../lib/superformula";
import { PillButton } from "./PillButton";
import { TranscriptEditHint } from "./GalleryOnboarding";
import { TextButton } from "./TextButton";
import { transcriptCharacters, transcriptTypingDelay, transcriptTypingPace } from "../lib/transcriptTyping";
import type { VoiceRippleSpot } from "../lib/voicePeaks";
import { useLang, useT } from "../lib/i18n";

/** What went wrong with the words: lost on the way, or not heard (the service's own reason, in English). */
type TranscribeTrouble = { kind: "lost" } | { kind: "failed"; detail: string | null };

/** How many lines stay in view. Past this the passage scrolls instead of growing. */
const VISIBLE_LINES = 8;
/** One line, in em, from the transcript's own line-height. */
const LINE_EM = TRANSCRIPT.lineHeight;
const VIEW_MAX = `calc(${VISIBLE_LINES} * ${LINE_EM}em)`;
/** A short dissolve at a cut edge — the old full-height fade was for text that ran down into the water. */
const EDGE_FADE = "0.9em";
/** Near the latest line: still following. Farther: the reader has moved away. */
const STICK_PX = 12;

function edgeMask(top: boolean, bottom: boolean) {
  if (!top && !bottom) return undefined;
  if (top && bottom) {
    return `linear-gradient(to bottom, transparent, #000 ${EDGE_FADE}, #000 calc(100% - ${EDGE_FADE}), transparent)`;
  }
  if (bottom) return `linear-gradient(to bottom, #000 calc(100% - ${EDGE_FADE}), transparent)`;
  return `linear-gradient(to bottom, transparent, #000 ${EDGE_FADE})`;
}
/** Where the water stirs while the words are coming: a little further out (y .75 of the screen, was .81; 2026-11-25). */
const TRANSCRIBING_SPOT = { x: .5, y: .75, strength: .7, soft: true };
/** Edits settle into the draft this long after the last keystroke (and at once on blur or continue). */
const EDIT_SETTLE_MS = 400;
/** The printout sets its words .3em apart; the editable text keeps that gap with word-spacing. */
const WORD_GAP_EM = 0.3;
/** The edit tip's distance above the first line of the words, in vh. */
const TIP_GAP_VH = 14.6;
const spoken = (text: string) => text.replace(/\s+/g, " ").trim();

interface PuddleTranscriptState {
  transcript?: string;
  transcriptionId?: string;
  focus?: [number, number];
  shape?: { form?: ArtifactForm };
  transcriptReady?: boolean;
  /** Stable for this visit once the descent has been opened, so backing out
      and continuing again keeps the same memory. */
  memoryId?: string;
  cameraPermission?: "pending" | "granted" | "denied";
}

/**
 * Transcript chrome over the pond — same words as the former transcript
 * page, without leaving the water or painting a second puddle.
 */
export function PuddleTranscriptPage({ reducedMotion = false, onTranscribingPulse }: {
  reducedMotion?: boolean;
  onTranscribingPulse?: (at: VoiceRippleSpot) => void;
}) {
  const ui = useT();
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as PuddleTranscriptState | null) ?? null;
  const focus = state?.focus;
  const transcriptionId = state?.transcriptionId;

  /* A real recording arrives as an id — the words are still being heard while
     the water settles here. Only a deep link (or the sample button) falls back
     to the sample memory. */
  const pending = getTranscription(transcriptionId);
  const [transcript, setTranscript] = useState(() => {
    if (state?.transcript?.trim()) return state.transcript;
    if (pending?.result?.transcript?.trim()) return pending.result.transcript;
    return transcriptionId ? "" : SAMPLE_TRANSCRIPT;
  });
  const [transcribeError, setTranscribeError] = useState<TranscribeTrouble | null>(() => {
    if (state?.transcript?.trim()) return null;
    if (pending?.result && !pending.result.transcript?.trim()) return { kind: "failed", detail: pending.result.error };
    if (transcriptionId && !pending && !state?.transcript?.trim()) {
      return { kind: "lost" };
    }
    return null;
  });
  const [awaitingTranscript, setAwaitingTranscript] = useState(
    () => !state?.transcript?.trim() && !!pending && pending.result === null,
  );

  const words = transcript.split(/\s+/);
  const printing = useMemo(() => {
    let start = 0;
    const parts = transcript.split(/\s+/).map(word => {
      const characters = transcriptCharacters(word);
      const part = { characters, start };
      start += characters.length + 1;
      return part;
    });
    return { parts, characters: transcriptCharacters(transcript.split(/\s+/).join(" ")) };
  }, [transcript]);
  const restored = !!state?.transcriptReady && !!transcript.trim();

  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() => (restored ? printing.characters.length : 0));
  const [isTyping, setIsTyping] = useState(!restored);
  const [showContinue, setShowContinue] = useState(restored);
  const [fadeOutContent, setFadeOutContent] = useState(false);
  const continueTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (continueTimer.current !== null) window.clearTimeout(continueTimer.current);
  }, []);
  const typingTimerRef = useRef<number | null>(null);
  const typingFinishRef = useRef<number | null>(null);
  const pulseRef = useRef(onTranscribingPulse);
  pulseRef.current = onTranscribingPulse;
  // The visible transcription includes its printout, even for the sample or
  // a response that arrives before this screen mounts.
  const transcribing = !transcribeError && (awaitingTranscript || isTyping);
  useEffect(() => {
    if (!transcribing || reducedMotion) return;
    let timer: number;
    const pulse = () => {
      pulseRef.current?.({ ...TRANSCRIBING_SPOT, strength: .6 + Math.random() * .16 });
      // A quiet, uneven cadence; existing waves finish naturally after typing.
      timer = window.setTimeout(pulse, 1250 + Math.random() * 450);
    };
    pulse();
    return () => window.clearTimeout(timer);
  }, [transcribing, reducedMotion]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  /** While true, the latest line stays at the foot. A scroll away turns it off; returning turns it on. */
  const stickRef = useRef(true);
  const gapRef = useRef(0);
  const [fadeEdges, setFadeEdges] = useState({ top: false, bottom: false });

  const typingDoneRef = useRef(restored);

  const [memoryId] = useState(() => state?.memoryId ?? crypto.randomUUID());

  // Keep the finished words in this history entry so photo Back and reload
  // reopen the same memory without printing it again.
  useEffect(() => {
    if (awaitingTranscript || transcribeError || !transcript.trim()) return;
    if (state?.transcript === transcript && state?.memoryId === memoryId
      && state?.transcriptReady === !isTyping) return;
    void navigate(TRANSCRIPT_PATH + location.search, {
      replace: true,
      state: { ...state, memoryId, transcript, transcriptReady: !isTyping },
    });
  }, [transcript, awaitingTranscript, transcribeError, isTyping, memoryId, state, location.search, navigate]);

  // The words arriving from the transcription service
  useEffect(() => {
    if (!pending || !awaitingTranscript) return;
    let alive = true;
    pending.promise.then((result) => {
      if (!alive) return;
      if (result.transcript?.trim()) {
        setTranscript(result.transcript);
      } else {
        setTranscribeError({ kind: "failed", detail: result.error });
      }
      setAwaitingTranscript(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, awaitingTranscript]);

  useEffect(() => {
    if (awaitingTranscript || transcribeError || !transcript.trim()) return;
    if (typingDoneRef.current || reducedMotion) {
      setVisibleCharacterCount(printing.characters.length);
      typingDoneRef.current = true;
      stickRef.current = false;
      setIsTyping(false);
      setShowContinue(true);
      return;
    }
    let count = 0;
    const pace = transcriptTypingPace(printing.characters);
    setVisibleCharacterCount(0);
    const typeNext = () => {
      count++;
      setVisibleCharacterCount(count);
      if (count >= printing.characters.length) {
        typingDoneRef.current = true;
        setIsTyping(false);
        typingFinishRef.current = window.setTimeout(() => setShowContinue(true), 300);
        return;
      }
      typingTimerRef.current = window.setTimeout(typeNext, transcriptTypingDelay(printing.characters[count - 1], count - 1) * pace);
    };
    typingTimerRef.current = window.setTimeout(typeNext, 180);

    return () => {
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
      if (typingFinishRef.current !== null) window.clearTimeout(typingFinishRef.current);
    };
  }, [printing, awaitingTranscript, transcribeError, transcript, reducedMotion]);

  /* A click while the words are still printing shows the whole body at once.
     Buttons and links are left alone. */
  useEffect(() => {
    if (!isTyping || awaitingTranscript || transcribeError) return;
    const skip = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea, [data-transcript-viewport]")) return;
      if (typingTimerRef.current !== null) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      typingDoneRef.current = true;
      stickRef.current = false;
      setVisibleCharacterCount(printing.characters.length);
      setIsTyping(false);
      setShowContinue(true);
    };
    window.addEventListener("pointerdown", skip);
    return () => window.removeEventListener("pointerdown", skip);
  }, [isTyping, awaitingTranscript, transcribeError, printing]);

  const goToRecord = () => {
    navigate(RECORD_START_PATH + location.search, {
      state: {
        ...(focus ? { focus } : {}),
        ...(state?.shape ? { shape: state.shape } : {}),
      },
    });
  };

  const handleContinue = () => {
    if (fadeOutContent || !showContinue || awaitingTranscript || transcribeError) return;
    const text = editing ? settleEdit() : transcript;
    if (!text.trim()) return;
    editRef.current?.blur();
    setFadeOutContent(true);
    continueTimer.current = window.setTimeout(() => {
      navigate(DESCENT_PATH + location.search, {
        state: { ...state, transcript: text, memoryId, transcriptReady: true, focus },
      });
    }, reducedMotion ? 0 : 1000);
  };

  /* Once printed, the words are the text itself: a click puts the caret in
     them and they can be changed in place. The field looks exactly as the
     printout did (no outline, no tint); only the caret shows. */
  const editing = !isTyping && !awaitingTranscript && !transcribeError;
  const editRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const [wordSpacing, setWordSpacing] = useState<string | undefined>(undefined);
  const [emptied, setEmptied] = useState(false);
  // the words the field opens with, fixed when it opens: React never writes them again, so it keeps what is typed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const openingText = useMemo(() => spoken(transcript), [editing]);
  useLayoutEffect(() => {
    const el = editRef.current;
    if (!editing || !el) return;
    // a space in this face, so the text keeps the printout's .3em between words
    const css = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d");
    const size = parseFloat(css.fontSize) || 16;
    if (ctx) {
      ctx.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const space = ctx.measureText(" ").width / size;
      const letter = (parseFloat(css.letterSpacing) || 0) / size;
      setWordSpacing(`${(WORD_GAP_EM - space - letter).toFixed(4)}em`);
    }
  }, [editing]);
  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
  }, []);
  const editedText = () => (editRef.current ? spoken(editRef.current.textContent ?? "") : spoken(transcript));
  const settleEdit = () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = null;
    const text = editedText();
    if (text && text !== transcript) setTranscript(text);
    return text;
  };
  const onEdit = () => {
    setEmptied(!editedText());
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settleEdit, EDIT_SETTLE_MS);
  };

  const pairReady = showContinue && !transcribeError;
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const barDrag = useRef<{ y: number; top: number } | null>(null);

  const syncScrollChrome = (el: HTMLDivElement) => {
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
    const overflow = el.scrollHeight - el.clientHeight;
    const top = el.scrollTop > 8;
    const bottom = gap > STICK_PX;
    setFadeEdges(prev => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    if (overflow <= 1) setBar(prev => (prev === null ? prev : null));
    else {
      const track = el.clientHeight;
      const height = Math.max(16, track * (el.clientHeight / el.scrollHeight));
      const travel = Math.max(1, track - height);
      const thumbTop = (el.scrollTop / overflow) * travel;
      setBar(prev => (prev && Math.abs(prev.top - thumbTop) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { top: thumbTop, height }));
    }
    return gap;
  };

  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    let user = false;
    const markUser = () => {
      user = true;
      const top = container.scrollTop;
      // Drop an in-flight follow so it does not pull the passage back down.
      container.scrollTop = top;
      // A wheel that could not move has nothing to do with following.
      requestAnimationFrame(() => { if (container.scrollTop === top) user = false; });
    };
    const handleScroll = () => {
      const gap = syncScrollChrome(container);
      if (user) {
        stickRef.current = gap <= STICK_PX;
        user = false;
      }
      gapRef.current = gap;
    };
    const watched = new Set<Element>();
    const watch = () => {
      const inner = container.firstElementChild;
      if (inner && !watched.has(inner)) {
        watched.add(inner);
        ro.observe(inner);
      }
    };
    const ro = new ResizeObserver(() => {
      watch();
      syncScrollChrome(container);
      if (!stickRef.current) return;
      const top = container.scrollHeight - container.clientHeight;
      if (top - container.scrollTop <= 1) return;
      gapRef.current = top - container.scrollTop;
      container.scrollTo({ top, behavior: reducedMotion || !isTyping ? "auto" : "smooth" });
    });
    ro.observe(container);
    watch();
    container.addEventListener("scroll", handleScroll);
    container.addEventListener("wheel", markUser, { passive: true });
    container.addEventListener("touchmove", markUser, { passive: true });
    handleScroll();
    return () => {
      ro.disconnect();
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", markUser);
      container.removeEventListener("touchmove", markUser);
    };
  }, [words.length, pairReady, transcribeError, isTyping, editing, reducedMotion]);

  const onBarDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = transcriptRef.current;
    const track = event.currentTarget;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    stickRef.current = false;
    const overflow = el.scrollHeight - el.clientHeight;
    const rect = track.getBoundingClientRect();
    const thumb = bar?.height ?? 16;
    const travel = Math.max(1, rect.height - thumb);
    const local = event.clientY - rect.top - thumb / 2;
    const jump = (local / travel) * overflow;
    if (event.target === track) el.scrollTop = jump;
    barDrag.current = { y: event.clientY, top: el.scrollTop };
    track.setPointerCapture(event.pointerId);
  };
  const onBarMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = barDrag.current;
    const el = transcriptRef.current;
    if (!drag || !el) return;
    const overflow = el.scrollHeight - el.clientHeight;
    const track = event.currentTarget.getBoundingClientRect().height;
    const thumb = bar?.height ?? 16;
    const travel = Math.max(1, track - thumb);
    el.scrollTop = drag.top + ((event.clientY - drag.y) / travel) * overflow;
  };
  const onBarUp = () => {
    barDrag.current = null;
    const el = transcriptRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.clientHeight - el.scrollTop <= STICK_PX;
  };

  // While the printout is running and the reader is still at the latest line, keep that line at the foot.
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (!el || !isTyping || !stickRef.current) return;
    const top = el.scrollHeight - el.clientHeight;
    const gap = top - el.scrollTop;
    if (gap <= 1) return;
    gapRef.current = gap;
    el.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  }, [visibleCharacterCount, isTyping, reducedMotion]);

  const wasTypingRef = useRef(isTyping);
  // The printed words are replaced by the field. Stay with the end only if the reader was already there.
  useLayoutEffect(() => {
    const wasTyping = wasTypingRef.current;
    wasTypingRef.current = isTyping;
    const el = transcriptRef.current;
    if (!el || !wasTyping || isTyping || !stickRef.current) return;
    const top = el.scrollHeight - el.clientHeight;
    if (top <= 1) return;
    gapRef.current = 0;
    el.scrollTop = top;
    syncScrollChrome(el);
  }, [isTyping]);

  return (
    <div
      className="absolute inset-0"
      data-transcript-screen
      style={{
        /* no z-index: a stacking context here would isolate the screen from the pond under it, and
           the actions' multiplied words would have nothing to darken. It comes after the water and
           its grain in the stage, so it is drawn over them all the same (2026-11-25; was 30). */
        userSelect: "text",
        opacity: fadeOutContent ? 0 : 1,
        transition: "opacity 1s ease",
        pointerEvents: "none",
      }}
    >
        <div
          className="overflow-hidden"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: `calc(${FLOW_PAGE.headingTop} + 96px)`,
            bottom: `calc(${FLOW_PAGE.surfaceActionBottom} + ${FLOW_PAGE.actionHeight + 24}px)`,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            paddingLeft: "clamp(20px, 5vw, 40px)",
            paddingRight: "clamp(20px, 5vw, 40px)",
            pointerEvents: fadeOutContent ? "none" : "auto",
          }}
        >
          <p
            role={transcribeError ? "alert" : undefined}
            style={{
              margin: 0,
              flexShrink: 0,
              minHeight: "1.45em",
              textAlign: "center",
              fontFamily: SERIF,
              fontSize: NOTE_SIZE,
              lineHeight: 1.45,
              color: CHROME_GRAY,
              visibility:
                transcribeError
                  ? "visible"
                  : "hidden",
            }}
          >
            {transcribeError
              ? ui.couldntHear(transcribeError.kind === "lost" ? ui.transcriptLost
                // the service's reason is English: Chinese says it plainly instead
                : lang === "en" && transcribeError.detail ? transcribeError.detail : ui.transcriptFailed)
              : ""}
          </p>
          <div
            style={{
              width: TRANSCRIPT_WIDTH,
              flex: "0 1 auto",
              minHeight: 0,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 48,
              cursor: isTyping && !awaitingTranscript ? "pointer" : undefined,
            }}
          >
            <style>{`
              .nijimu-transcript-scroll { scrollbar-width: none; }
              .nijimu-transcript-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
            `}</style>
            <div
              data-transcript-viewport
              style={{ position: "relative", width: "100%", maxWidth: "80ch", flex: "0 1 auto", minHeight: 0, maxHeight: VIEW_MAX }}
            >
            <div
              ref={transcriptRef}
              className="nijimu-transcript-scroll overflow-y-auto overflow-x-hidden"
              style={{
                ...TRANSCRIPT,
                width: "100%",
                /* Eight lines at most; a shorter passage stays its own height. */
                minHeight: 0,
                maxHeight: VIEW_MAX,
                color: CHROME_GRAY,
                textAlign: "center",
                position: "relative",
                zIndex: 0,
                overflowAnchor: "none",
                paddingRight: bar ? 12 : 0,
                /* A cut edge thins into the water. The latest line, at the foot, stays whole. */
                ...(edgeMask(fadeEdges.top, fadeEdges.bottom)
                  ? { maskImage: edgeMask(fadeEdges.top, fadeEdges.bottom), WebkitMaskImage: edgeMask(fadeEdges.top, fadeEdges.bottom) }
                  : {}),
              }}
            >
              {editing ? (
                <div
                  ref={editRef}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label={ui.transcriptBox}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  onInput={onEdit}
                  onBlur={() => { settleEdit(); }}
                  onKeyDown={(e) => {
                    // the pond listens on the window (Escape / ArrowUp go back): typing stays here
                    e.stopPropagation();
                    if (e.key === "Escape") e.currentTarget.blur();
                    // one passage: Enter does not start a new paragraph
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  style={{
                    outline: "none",
                    caretColor: CHROME_GRAY,
                    cursor: "text",
                    wordSpacing,
                    // a space at a line's end takes its room, as the printout's gap after a word did,
                    // so the lines break where they broke while printing
                    whiteSpace: "break-spaces",
                    overflowWrap: "break-word",
                    minHeight: "1.45em",
                  }}
                >{openingText}</div>
              ) : <>
              {isTyping && <span className="sr-only">{transcript}</span>}
              {words.map((word, index) => {
                const printedWord = printing.parts[index];
                if (!printedWord || (isTyping && visibleCharacterCount <= printedWord.start)) return null;
                const isVisible = visibleCharacterCount > printedWord.start;

                return (
                  <span
                    key={index}
                    aria-hidden={isTyping || !isVisible}
                    style={{
                      position: "relative",
                      display: "inline-block",
                      opacity: isVisible ? 1 : 0,
                      marginRight: index < words.length - 1 ? "0.3em" : 0,
                    }}
                  >
                    <span style={{ position: "relative", zIndex: 1 }}>
                      {isTyping ? printedWord.characters.map((character, at) => <span key={at}
                        style={{ opacity: printedWord.start + at < visibleCharacterCount ? 1 : 0 }}>{character}</span>) : word}
                    </span>
                  </span>
                );
              })}
              </>}
            </div>
            {bar && (
              <div
                aria-hidden
                onPointerDown={onBarDown}
                onPointerMove={onBarMove}
                onPointerUp={onBarUp}
                onPointerCancel={onBarUp}
                style={{
                  position: "absolute",
                  top: 3,
                  bottom: 3,
                  right: 1,
                  width: 4,
                  borderRadius: 999,
                  background: "rgba(126, 126, 134, .16)",
                  touchAction: "none",
                }}
              >
                <div style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: bar.top,
                  height: bar.height,
                  borderRadius: 999,
                  background: "rgba(126, 126, 134, .55)",
                }} />
              </div>
            )}
            </div>
          </div>
        </div>
        {/* as the gallery's "keep scrolling", above the words: they can be edited in place. TIP_GAP_VH of the
            screen's height clear of the first line (~112px on a 768px-tall window; was ~75px) — the words start
            137px under the heading row (96 + the error line's ~17 + its 24 gap), the tip's line ends 16px under its top */}
        <TranscriptEditHint ready={editing && !fadeOutContent} top={`calc(${FLOW_PAGE.headingTop} + 121px - ${TIP_GAP_VH}vh)`} />
        {/* "record again" is there as soon as a recording's words are; continue waits for the printout (a click skips it).
            The sample (no recording behind it) shows the two together, once the printout is nearly through. */}
        {(!awaitingTranscript || transcribeError) && (
          <div
            style={{
              /* the actions' row, as on the recording screen; centred by its margins, not a
                 transform, which would isolate it and leave the words' multiply nothing to darken */
              position: "absolute",
              left: 0,
              right: 0,
              marginInline: "auto",
              width: "fit-content",
              bottom: FLOW_PAGE.surfaceActionBottom,
              minHeight: FLOW_PAGE.actionHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 22,
              pointerEvents: "auto",
            }}
          >
            {transcribeError ? (
              <TextButton label={ui.recordAgain} onClick={goToRecord} style={{ width: "9em", justifyContent: "center", mixBlendMode: "multiply" }} />
            ) : (
              <>
                <TextButton
                  label={ui.recordAgain}
                  onClick={goToRecord}
                  style={{ width: "9em", justifyContent: "center", mixBlendMode: "multiply", visibility: transcriptionId || pairReady ? "visible" : "hidden" }}
                />
                <PillButton
                  label={ui.continue}
                  trailing="›"
                  surface="glass"
                  textBlend="multiply"
                  onClick={handleContinue}
                  disabled={fadeOutContent || emptied}
                  style={{ visibility: pairReady && !emptied ? "visible" : "hidden" }}
                />
              </>
            )}
          </div>
        )}
    </div>
  );
}
