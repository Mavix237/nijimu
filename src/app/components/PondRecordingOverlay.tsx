import { FlowPageGrid } from "./FlowPageGrid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useCompact } from "../hooks/useCompact";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { CHROME_GRAY } from "../lib/colors";
import { FLOW_PAGE, SERIF, NOTE_SIZE, INSTRUCTION_SIZE, TRANSCRIPT, TRANSCRIPT_WIDTH, UNDERWATER_PHONE } from "../lib/theme";
import { PAGE_HEADER_MARK } from "./PageHeader";
import { beginTranscription } from "../lib/transcribe";
import { PARTICLE_TEXT_KEYFRAMES, ParticleText } from "./ParticleText";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";
import { RecordingInstructionsDialog } from "./RecordingInstructionsDialog";
import { TRANSCRIPT_PATH, MEMORY_POND_PATH } from "../lib/routes";
import { ArtifactForm, createArtifactForm, formFromState } from "../lib/superformula";
import { createVoiceRippleBurstPlanner, pickVoiceRippleSpot, type VoiceRippleSpot } from "../lib/voicePeaks";

const QUESTION_DELAY_S = 0.35;
const QUESTION_SWEEP_S = 0.5;
const NOTE_1_DELAY_S = 0.9;
const NOTE_SWEEP_S = 0.7;
const BUTTON_IN_DELAY_MS = 1900;
const CHROME_OUT_MS = 500;

const noteStyle = {
  margin: 0,
  fontFamily: SERIF,
  fontSize: NOTE_SIZE,
  lineHeight: 1.45,
  color: CHROME_GRAY,
} as const;

interface RecordingArrival {
  transcript?: string;
  transcriptionId?: string;
  focus?: [number, number];
  shape?: { form?: ArtifactForm };
}

/**
 * Prompt and record controls laid over the pond — same words as the old
 * record-start screen, without leaving the water or placing a form on it.
 */
export function PondRecordingOverlay({
  reducedMotion = false,
  onVoicePulse,
}: {
  reducedMotion?: boolean;
  onVoicePulse?: (at: VoiceRippleSpot) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const compact = useCompact();
  const arrival = (location.state as RecordingArrival | null) ?? null;
  const focus = arrival?.focus;

  const [buttonIn, setButtonIn] = useState(reducedMotion);
  const [leaving, setLeaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [openingMicrophone, setOpeningMicrophone] = useState(false);
  // The memory's form is assigned here, before it has words, and travels with
  // it through every step after. Recording again keeps the same one.
  const [form] = useState(() => formFromState(arrival) ?? createArtifactForm());
  const lastRipple = useRef<VoiceRippleSpot | null>(null);
  const planBurst = useRef(createVoiceRippleBurstPlanner());
  const pendingRipples = useRef(new Set<number>());
  const canRipple = useRef(false);
  const pulseCallback = useRef(onVoicePulse);
  pulseCallback.current = onVoicePulse;
  const cancelRipples = useCallback(() => {
    canRipple.current = false;
    pendingRipples.current.forEach(id => window.clearTimeout(id));
    pendingRipples.current.clear();
  }, []);

  const recorder = useVoiceRecorder({
    onVoicePeak: level => {
      if (!canRipple.current) return;
      for (const ripple of planBurst.current(level, performance.now())) {
        const emit = () => {
          if (!canRipple.current) return;
          const at = { ...pickVoiceRippleSpot(lastRipple.current), strength: ripple.strength };
          lastRipple.current = at;
          pulseCallback.current?.(at);
        };
        if (ripple.delayMs === 0) emit();
        else {
          const id = window.setTimeout(() => {
            pendingRipples.current.delete(id);
            emit();
          }, ripple.delayMs);
          pendingRipples.current.add(id);
        }
      }
    },
    onStop: (audio) => {
      cancelRipples();
      if (!audio) {
        setCaptureFailed(true);
        return;
      }
      const transcriptionId = beginTranscription(audio);
      setLeaving(true);
      setTimeout(() => {
        navigate(TRANSCRIPT_PATH + location.search, {
          state: {
            transcriptionId,
            shape: { form },
            ...(focus ? { focus } : {}),
          },
        });
      }, CHROME_OUT_MS);
    },
  });
  canRipple.current = recorder.isRecording && !reducedMotion && !leaving;
  useEffect(() => {
    if (!recorder.isRecording || reducedMotion || leaving) cancelRipples();
  }, [recorder.isRecording, reducedMotion, leaving, cancelRipples]);
  useEffect(() => cancelRipples, [cancelRipples]);

  const troubleMessage = captureFailed
    ? "The recording didn't come through — try again"
    : recorder.error === "not-allowed"
      ? "microphone access is off. allow it in your browser’s site settings, then try again—or explore with a sample memory."
      : recorder.error === "unsupported"
        ? "This browser can't record — try chrome"
        : recorder.error === "failed"
          ? "The microphone couldn't be opened — try again"
          : null;

  useEffect(() => {
    if (reducedMotion) return;
    const button = setTimeout(() => setButtonIn(true), BUTTON_IN_DELAY_MS);
    return () => clearTimeout(button);
  }, [reducedMotion]);

  const startRecording = async () => {
    if (openingMicrophone || leaving) return;
    setCaptureFailed(false);
    setOpeningMicrophone(true);
    setButtonIn(true);
    planBurst.current = createVoiceRippleBurstPlanner();
    try { await recorder.start(); }
    finally { setOpeningMicrophone(false); }
  };

  const goToSampleTranscript = () => {
    if (leaving) return;
    setSkipping(true);
    setLeaving(true);
    setTimeout(() => {
      navigate(TRANSCRIPT_PATH + location.search, {
        state: {
          shape: { form },
          ...(focus ? { focus } : {}),
        },
      });
    }, CHROME_OUT_MS);
  };

  const fadeStyle = (visible: boolean) =>
    ({
      opacity: visible && !leaving ? 1 : 0,
      transition: "opacity 0.9s ease",
    }) as const;

  const leaveStyle = {
    opacity: leaving ? 0 : 1,
    transition: `opacity ${CHROME_OUT_MS}ms ease`,
  } as const;

  // No first-visit flag: every entry (and failed attempt) gets the same
  // instructions. The microphone opens only after the primary action.
  if (!recorder.isRecording && (!leaving || skipping)) return <div
    style={{ opacity: leaving ? 0 : 1, transition: `opacity ${CHROME_OUT_MS}ms ease`, pointerEvents: leaving ? "none" : undefined }}>
    <RecordingInstructionsDialog
    busy={openingMicrophone} error={troubleMessage} onStart={startRecording}
    onSkip={goToSampleTranscript} onClose={() => navigate(MEMORY_POND_PATH, { state: arrival })} />
  </div>;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 30 }}>
      <style>{`
        ${PARTICLE_TEXT_KEYFRAMES}
        @keyframes puddleRecIn {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: none; }
        }
      `}</style>

      <FlowPageGrid headingStyle={{ maxWidth: "none" }} heading={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, ...leaveStyle }}>
          <div style={{ margin: 0, width: "100%", textAlign: "center", color: CHROME_GRAY, fontFamily: SERIF,
            fontSize: compact ? UNDERWATER_PHONE.labelSize : PAGE_HEADER_MARK.fontSize, lineHeight: 1.45 }}>
            <ParticleText
              text="Speak about a memory."
              seed={41}
              animate={!reducedMotion}
              delay={QUESTION_DELAY_S}
              sweep={QUESTION_SWEEP_S}
              wrap
              soft
            />
          </div>
          {/* as wide as the transcript that follows: measured in its font */}
          <div style={{ fontFamily: TRANSCRIPT.fontFamily, fontSize: TRANSCRIPT.fontSize, width: TRANSCRIPT_WIDTH }}>
            <div style={{ ...noteStyle, fontSize: INSTRUCTION_SIZE, lineHeight: 1.6, textAlign: "center" }}>
              <ParticleText
                text="Think of a memory in your mind, and talk about it freely."
                seed={53}
                animate={!reducedMotion}
                delay={NOTE_1_DELAY_S}
                sweep={NOTE_SWEEP_S}
                wrap
                soft
              />
              <ParticleText
                text="Stop when the story feels complete."
                seed={59}
                animate={!reducedMotion}
                delay={NOTE_1_DELAY_S + NOTE_SWEEP_S}
                sweep={NOTE_SWEEP_S}
                wrap
                soft
              />
            </div>
          </div>
        </div>
      }
      actionBottom={FLOW_PAGE.surfaceActionBottom}
      actionsStyle={{ pointerEvents: buttonIn && !leaving ? "auto" : "none", ...fadeStyle(buttonIn) }} actions={
        // Hold the stop pill through the fade. Swapping to record / sample
        // the moment recording ends flashes those two buttons on the way out.
        !recorder.isRecording && !leaving ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <TextButton
              label={captureFailed ? "record again" : "record"}
              onClick={startRecording}
              style={{ width: "9em", justifyContent: "center" }}
            />
            <span aria-hidden style={{ width: 1, height: "1em", background: "rgba(123, 123, 135, 0.45)", flexShrink: 0 }} />
            <TextButton
              label="sample story"
              onClick={goToSampleTranscript}
              style={{ width: "9em", justifyContent: "center" }}
            />
          </div>
        ) : (
          <PillButton
            label="stop"
            icon={<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden><rect x="4" y="4" width="12" height="12" rx="2" fill={CHROME_GRAY} /></svg>}
            onClick={() => { cancelRipples(); recorder.stop(); }}
          />
        )
      } />
      {/* the timer, or what went wrong, in the middle of the water */}
      {(recorder.isRecording || troubleMessage) && (
        <p role={troubleMessage ? "alert" : "timer"} aria-label={troubleMessage ? undefined : "recording duration"}
          style={{ ...noteStyle, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            width: "min(28em, calc(100% - 40px))", textAlign: "center", fontVariantNumeric: "tabular-nums",
            opacity: !buttonIn || leaving ? 0 : 1,
            transition: "opacity 0.4s ease", pointerEvents: "none",
            animation: reducedMotion ? "none" : "puddleRecIn 700ms ease backwards" }}>
          {troubleMessage ?? `recording · ${Math.floor(recorder.duration / 60)}:${String(recorder.duration % 60).padStart(2, "0")}`}
        </p>
      )}
    </div>
  );
}
