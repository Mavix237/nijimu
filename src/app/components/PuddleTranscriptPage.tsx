import { FLOW_PAGE } from "../lib/theme";
import { SAMPLE_TRANSCRIPT } from "../data/sampleMemory";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** Soft wash over the pond so long transcripts fade at the end of the passage. */
/** The foot of a long transcript, thinned to nothing over the last 72–120px (20% of it already clear). */
const TRANSCRIPT_FADE_MASK = "linear-gradient(to bottom, #000 calc(100% - clamp(72px, 12vh, 120px)), rgba(0,0,0,.12) calc(100% - clamp(72px, 12vh, 120px) * .2), transparent)";
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
  const [transcribeError, setTranscribeError] = useState<string | null>(() => {
    if (state?.transcript?.trim()) return null;
    if (pending?.result && !pending.result.transcript?.trim()) return pending.result.error ?? "The transcription didn’t come through — try recording again.";
    if (transcriptionId && !pending && !state?.transcript?.trim()) {
      return "The transcription was lost — try recording again.";
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
  const [showBottomFade, setShowBottomFade] = useState(false);

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
        setTranscribeError(result.error ?? "The transcription didn’t come through — try recording again.");
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
      if (target instanceof Element && target.closest("button, a, input, textarea")) return;
      if (typingTimerRef.current !== null) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      typingDoneRef.current = true;
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
  // once the words have been clicked into, the tip that says they can be has done its work
  const [touched, setTouched] = useState(false);
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

  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      setShowBottomFade(scrollBottom > 10);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [words.length, pairReady, transcribeError]);

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
              ? `couldn't hear that — ${transcribeError.toLowerCase()}`
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
            <div
              ref={transcriptRef}
              className="overflow-y-auto overflow-x-hidden"
              style={{
                ...TRANSCRIPT,
                width: "100%",
                maxWidth: "80ch",
                /* Long passages scroll; the actions sit just under the last line. */
                minHeight: 0,
                flex: "1 1 auto",
                color: CHROME_GRAY,
                textAlign: "center",
                position: "relative",
                zIndex: 0,
                /* The words thin out at the foot themselves, over whatever
                   water is behind them (no colour laid over it to match). */
                ...(showBottomFade ? { maskImage: TRANSCRIPT_FADE_MASK, WebkitMaskImage: TRANSCRIPT_FADE_MASK } : {}),
              }}
            >
              {editing ? (
                <div
                  ref={editRef}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="your memory, in words"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  onInput={onEdit}
                  onFocus={() => setTouched(true)}
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
          </div>
        </div>
        {/* as the gallery's "keep scrolling", above the words: they can be edited in place. TIP_GAP_VH of the
            screen's height clear of the first line (~112px on a 768px-tall window; was ~75px) — the words start
            137px under the heading row (96 + the error line's ~17 + its 24 gap), the tip's line ends 16px under its top */}
        <TranscriptEditHint ready={editing && !touched && !fadeOutContent} top={`calc(${FLOW_PAGE.headingTop} + 121px - ${TIP_GAP_VH}vh)`} />
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
              <TextButton label="record again" onClick={goToRecord} style={{ width: "9em", justifyContent: "center", mixBlendMode: "multiply" }} />
            ) : (
              <>
                <TextButton
                  label="record again"
                  onClick={goToRecord}
                  style={{ width: "9em", justifyContent: "center", mixBlendMode: "multiply", visibility: transcriptionId || pairReady ? "visible" : "hidden" }}
                />
                <PillButton
                  label="continue"
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
