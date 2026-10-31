import { FLOW_PAGE } from "../lib/theme";
import { SAMPLE_TRANSCRIPT } from "../data/sampleMemory";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CHROME_GRAY } from "../lib/colors";
import { DESCENT_PATH, RECORD_START_PATH, TRANSCRIPT_PATH } from "../lib/routes";
import { NOTE_SIZE, SERIF, TRANSCRIPT, TRANSCRIPT_WIDTH } from "../lib/theme";
import { getTranscription } from "../lib/transcribe";
import type { ArtifactForm } from "../lib/superformula";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";
import { transcriptCharacters, transcriptTypingDelay, transcriptTypingPace } from "../lib/transcriptTyping";
import type { VoiceRippleSpot } from "../lib/voicePeaks";

/** Soft wash over the pond so long transcripts fade at the end of the passage. */
const POND_FADE = "rgba(226, 230, 226, 0.88)";
const TRANSCRIBING_SPOT = { x: .5, y: .81, strength: .7, soft: true };

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
    if (fadeOutContent || !showContinue || awaitingTranscript || transcribeError || !transcript.trim()) return;
    setFadeOutContent(true);
    continueTimer.current = window.setTimeout(() => {
      navigate(DESCENT_PATH + location.search, {
        state: { ...state, transcript, memoryId, transcriptReady: true, focus },
      });
    }, reducedMotion ? 0 : 1000);
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
        zIndex: 30,
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
              }}
            >
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
        {/* "record again" is there as soon as the words are; continue waits for the printout (a click skips it) */}
        {(!awaitingTranscript || transcribeError) && (
          <div
            style={{
              /* the actions' row, as on the recording screen */
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
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
              <TextButton label="record again" onClick={goToRecord} style={{ width: "9em", justifyContent: "center" }} />
            ) : (
              <>
                <TextButton
                  label="record again"
                  onClick={goToRecord}
                  style={{ width: "9em", justifyContent: "center" }}
                />
                <PillButton
                  label="continue"
                  trailing="›"
                  onClick={handleContinue}
                  disabled={fadeOutContent}
                  style={{ visibility: pairReady ? "visible" : "hidden" }}
                />
              </>
            )}
          </div>
        )}
    </div>
  );
}
