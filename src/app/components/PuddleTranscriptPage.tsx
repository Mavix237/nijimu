import { FlowPageGrid } from "./FlowPageGrid";
import { FLOW_PAGE } from "../lib/theme";
import { SAMPLE_TRANSCRIPT } from "../data/sampleMemory";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CHROME_GRAY } from "../lib/colors";
import { DESCENT_PATH, RECORD_START_PATH, TRANSCRIPT_PATH } from "../lib/routes";
import { BODY_SIZE, NOTE_SIZE, SERIF, TRANSCRIPT, TRANSCRIPT_HIGHLIGHT } from "../lib/theme";
import { getTranscription } from "../lib/transcribe";
import type { ArtifactForm } from "../lib/superformula";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";

/** Soft wash over the pond so long transcripts fade at the end of the passage. */
const POND_FADE = "rgba(226, 230, 226, 0.88)";
/** Space between the transcript and the action row. */
/** The transcript group sits this far below the screen's top anchor. */



/** Word-by-word fade as the transcript arrives. */
const WORD_IN_MS = 80;
const WORD_IN = "opacity 0.3s ease-in";

interface PuddleTranscriptState {
  transcript?: string;
  transcriptionId?: string;
  focus?: [number, number];
  shape?: { form?: ArtifactForm };
  highlightedWords?: string[];
  highlightedWordIndices?: number[];
  transcriptReady?: boolean;
  highlightMode?: boolean;
  /** Stable for this visit once the descent has been opened, so backing out
      and continuing again keeps the same memory. */
  memoryId?: string;
  cameraPermission?: "pending" | "granted" | "denied";
}

/** The most words one highlight takes. */
const MAX_HIGHLIGHT = 2;

/** The highlighted words as they are lifted out: each run of neighbouring
    words is one phrase, so "orange peels" stays together — a longer run, made
    of highlights side by side, is lifted out a pair at a time. */
function highlightedPhrases(words: string[], indices: Set<number>): string[] {
  const phrases: string[] = [];
  let run: string[] = [];
  const sorted = Array.from(indices).sort((a, b) => a - b);
  sorted.forEach((i, k) => {
    run.push(words[i]);
    if (sorted[k + 1] !== i + 1 || run.length === MAX_HIGHLIGHT) {
      phrases.push(run.join(" "));
      run = [];
    }
  });
  return phrases;
}

/**
 * Transcript chrome over the pond — same words as the former transcript
 * page, without leaving the water or painting a second puddle.
 */
export function PuddleTranscriptPage() {
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
    if (pending?.result?.transcript) return pending.result.transcript;
    if (state?.transcript) return state.transcript;
    return transcriptionId ? "" : SAMPLE_TRANSCRIPT;
  });
  const [transcribeError, setTranscribeError] = useState<string | null>(() => {
    if (pending?.result?.error) return pending.result.error;
    if (transcriptionId && !pending && !state?.transcript) {
      return "The transcription was lost — try recording again.";
    }
    return null;
  });
  const [awaitingTranscript, setAwaitingTranscript] = useState(
    () => !!pending && pending.result === null,
  );

  const words = transcript.split(/\s+/);
  const restored = state?.transcriptReady || (state?.highlightedWordIndices?.length ?? 0) > 0;
  /** The stand-in memory, not a recording still being heard. */
  const isSample = !transcriptionId && transcript === SAMPLE_TRANSCRIPT;

  const [visibleWordCount, setVisibleWordCount] = useState(() => (restored ? words.length : 0));
  const [isTyping, setIsTyping] = useState(!restored);
  const [showContinue, setShowContinue] = useState(restored);
  const [highlightMode, setHighlightMode] = useState(
    () => state?.highlightMode || (state?.highlightedWordIndices?.length ?? 0) > 0,
  );
  const [highlightedWords, setHighlightedWords] = useState<Set<number>>(
    () => new Set(state?.highlightedWordIndices ?? []),
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [currentSelection, setCurrentSelection] = useState<Set<number>>(new Set());
  const [fadeOutContent, setFadeOutContent] = useState(false);
  const continueTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (continueTimer.current !== null) window.clearTimeout(continueTimer.current);
  }, []);
  const typingIntervalRef = useRef<number | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const typingDoneRef = useRef(restored);

  const [memoryId] = useState(() => state?.memoryId ?? crypto.randomUUID());

  // Save words as soon as they arrive, and each completed highlight immediately.
  // The header's Back uses location.state too, so it receives this same draft.
  // Never replace a pending real recording with an empty or sample transcript.
  useEffect(() => {
    if (awaitingTranscript || transcribeError || !transcript.trim()) return;
    const indices = Array.from(highlightedWords).sort((a, b) => a - b);
    if (state?.transcript === transcript && state?.memoryId === memoryId
      && state?.transcriptReady === !isTyping && state?.highlightMode === highlightMode
      && JSON.stringify(state?.highlightedWordIndices ?? []) === JSON.stringify(indices)) return;
    void navigate(TRANSCRIPT_PATH + location.search, {
      replace: true,
      state: { ...state, memoryId, transcript, transcriptReady: !isTyping, highlightMode,
        highlightedWords: highlightedPhrases(words, highlightedWords), highlightedWordIndices: indices },
    });
  }, [transcript, awaitingTranscript, transcribeError, highlightedWords, isTyping, highlightMode, memoryId, state, location.search, navigate]);

  // The words arriving from the transcription service
  useEffect(() => {
    if (!pending || !awaitingTranscript) return;
    let alive = true;
    pending.promise.then((result) => {
      if (!alive) return;
      if (result.transcript) {
        setTranscript(result.transcript);
      } else {
        setTranscribeError(result.error);
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
    if (typingDoneRef.current) {
      setVisibleWordCount(words.length);
      return;
    }
    typingIntervalRef.current = window.setInterval(() => {
      setVisibleWordCount((count) => {
        if (count < words.length) {
          return count + 1;
        }
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
        }
        typingDoneRef.current = true;
        setIsTyping(false);
        setTimeout(() => setShowContinue(true), 300);
        return count;
      });
    }, WORD_IN_MS);

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, [words.length, awaitingTranscript, transcribeError, transcript]);

  /* A click while the sample is still printing shows the whole body at once.
     Buttons and links are left alone. */
  useEffect(() => {
    if (!isSample || !isTyping) return;
    const skip = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea")) return;
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      typingDoneRef.current = true;
      setVisibleWordCount(words.length);
      setIsTyping(false);
      setShowContinue(true);
    };
    window.addEventListener("pointerdown", skip);
    return () => window.removeEventListener("pointerdown", skip);
  }, [isSample, isTyping, words.length]);

  const goToRecord = () => {
    navigate(RECORD_START_PATH, {
      state: {
        ...state,
        ...(focus ? { focus } : {}),
        ...(state?.shape ? { shape: state.shape } : {}),
      },
    });
  };

  const handleContinue = () => {
    if (fadeOutContent) return;
    if (!highlightMode) {
      setHighlightMode(true);
      setShowContinue(false);
    } else {
      setFadeOutContent(true);
      continueTimer.current = window.setTimeout(() => {
        navigate(DESCENT_PATH, {
          state: {
            ...state,
            transcript,
            memoryId,
            highlightedWords: highlightedPhrases(words, highlightedWords),
            highlightedWordIndices: Array.from(highlightedWords),
            focus,
          },
        });
      }, 1000);
    }
  };

  const handleMouseDown = (wordIndex: number) => {
    if (!highlightMode) return;
    setIsSelecting(true);
    setSelectionStart(wordIndex);
    setCurrentSelection(new Set([wordIndex]));
  };

  const handleMouseEnter = (wordIndex: number) => {
    if (!highlightMode || !isSelecting || selectionStart === null) return;

    // a highlight is a word or two, never more: the drag reaches one word past where it began
    const reach = Math.max(-(MAX_HIGHLIGHT - 1), Math.min(MAX_HIGHLIGHT - 1, wordIndex - selectionStart));
    const start = Math.min(selectionStart, selectionStart + reach);
    const end = Math.max(selectionStart, selectionStart + reach);

    const newSelection = new Set<number>();
    for (let i = start; i <= end; i++) {
      newSelection.add(i);
    }
    setCurrentSelection(newSelection);
  };

  const handleMouseUp = () => {
    if (!highlightMode || !isSelecting) return;

    const newHighlighted = new Set(highlightedWords);
    const allHighlighted = Array.from(currentSelection).every((i) => highlightedWords.has(i));

    if (allHighlighted) {
      currentSelection.forEach((i) => newHighlighted.delete(i));
    } else {
      currentSelection.forEach((i) => newHighlighted.add(i));
    }

    setHighlightedWords(newHighlighted);
    setIsSelecting(false);
    setSelectionStart(null);
    setCurrentSelection(new Set());

    setShowContinue(newHighlighted.size > 0);
  };

  useEffect(() => {
    if (highlightMode) {
      window.addEventListener("pointerup", handleMouseUp);
      window.addEventListener("pointercancel", handleMouseUp);
      return () => {
        window.removeEventListener("pointerup", handleMouseUp);
        window.removeEventListener("pointercancel", handleMouseUp);
      };
    }
  }, [highlightMode, isSelecting, currentSelection, highlightedWords]);

  const isWordHighlighted = (index: number) =>
    highlightedWords.has(index) || currentSelection.has(index);

  const hasHighlights = highlightedWords.size > 0;

  const pairReady = (showContinue || highlightMode) && !transcribeError;

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
      className="absolute inset-0 select-none"
      style={{
        zIndex: 30,
        userSelect: highlightMode ? "none" : "auto",
        opacity: fadeOutContent ? 0 : 1,
        transition: "opacity 1s ease",
        pointerEvents: "none",
      }}
    >
        <FlowPageGrid actions={(pairReady || transcribeError) && (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 22,
                  visibility: transcribeError || showContinue ? "visible" : "hidden",
                }}
              >
                {transcribeError ? (
                  <PillButton label="record again" onClick={goToRecord} />
                ) : (
                  <>
                    <TextButton
                      label="record again"
                      onClick={goToRecord}
                      style={{ width: "9em", justifyContent: "center" }}
                    />
                    <span
                      aria-hidden
                      style={{
                        width: 1,
                        height: "1em",
                        background: "rgba(123, 123, 135, 0.45)",
                        flexShrink: 0,
                      }}
                    />
                    <TextButton
                      label="continue"
                      onClick={handleContinue}
                      disabled={highlightMode && !hasHighlights}
                      style={{ width: "9em", justifyContent: "center" }}
                    />
                  </>
                )}
              </div>
            )} heading={highlightMode && (
          <div style={{ fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.5,
            color: CHROME_GRAY, textTransform: "lowercase" }}>
            <p style={{ margin: 0 }}>
              drag to{" "}
              <span style={{ position: "relative", display: "inline-block" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 2,
                    bottom: 2,
                    background: TRANSCRIPT_HIGHLIGHT,
                    zIndex: 0,
                  }}
                />
                <span style={{ position: "relative", zIndex: 1 }}>highlight</span>
              </span>{" "}
              the words
            </p>
            <p style={{ margin: 0 }}>that touch you the most.</p>
          </div>
        )} />

        <div
          className="overflow-hidden"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: `calc(${FLOW_PAGE.headingTop} + 96px)`,
            bottom: "clamp(120px, 18vh, 160px)",
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
                !highlightMode && (awaitingTranscript || transcribeError || isTyping)
                  ? "visible"
                  : "hidden",
            }}
          >
            {transcribeError
              ? `couldn't hear that — ${transcribeError.toLowerCase()}`
              : "transcribing..."}
          </p>
          <div
            style={{
              width: "min(80ch, 100%)",
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 0,
              cursor: isSample && isTyping ? "pointer" : undefined,
            }}
          >
            <div
              ref={transcriptRef}
              className="overflow-y-auto overflow-x-hidden"
              style={{
                ...TRANSCRIPT,
                width: "100%",
                maxWidth: "80ch",
                /* Actions live in the shared bottom row; only the passage scrolls. */
                maxHeight: "100%",
                minHeight: 0,
                flex: "0 1 auto",
                color: CHROME_GRAY,
                textAlign: "center",
                position: "relative",
                zIndex: 0,
              }}
            >
              {words.map((word, index) => {
                const isVisible = index < visibleWordCount;
                const isHighlighted = isWordHighlighted(index);
                // a run of highlighted words is one band, carried across the gaps
                const joinsNext = isHighlighted && index < words.length - 1 && isWordHighlighted(index + 1);

                return (
                  <span
                    key={index}
                    onPointerDown={(e) => {
                      // a finger captures the word it lands on; let go so the drag can reach the next one
                      e.currentTarget.releasePointerCapture(e.pointerId);
                      handleMouseDown(index);
                    }}
                    onPointerEnter={() => handleMouseEnter(index)}
                    style={{
                      position: "relative",
                      display: "inline-block",
                      opacity: isVisible ? 1 : 0,
                      transition: isTyping ? WORD_IN : "none",
                      cursor: highlightMode ? "pointer" : "default",
                      // a sideways drag highlights; an upright one still scrolls the passage
                      touchAction: highlightMode ? "pan-y" : undefined,
                      marginRight: index < words.length - 1 ? "0.3em" : 0,
                    }}
                  >
                    {isHighlighted && (
                      <span
                        style={{
                          position: "absolute",
                          left: -2,
                          right: joinsNext ? "calc(2px - 0.3em)" : -2,
                          top: 2,
                          bottom: 2,
                          background: TRANSCRIPT_HIGHLIGHT,
                          zIndex: 0,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
                  </span>
                );
              })}

              {showBottomFade && (
                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    height: 0,
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: "clamp(72px, 12vh, 120px)",
                      background: `linear-gradient(to top, ${POND_FADE} 20%, rgba(226, 230, 226, 0) 100%)`,
                    }}
                  />
                </div>
              )}
            </div>


          </div>
        </div>
    </div>
  );
}
