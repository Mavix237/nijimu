import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router";
import { useHoldToCreate } from "../hooks/useHoldToCreate";
import { CAROUSEL_PATH, MEMORY_POND_PATH, RECORD_START_PATH } from "../lib/routes";
import { CHROME_GRAY } from "../lib/colors";
import { INSTRUCTION_SIZE, POND_PROMPT_SIZE, SANS, SERIF, TEXT_ENTER_MS } from "../lib/theme";
import { POND_THOUGHTS, hasSeenPondInstruction, markPondInstructionSeen, pondPromptCue } from "../lib/pondPrompts";
import { PerspectivePond, type PondTouch, type PondProps } from "./PerspectivePond";
import { PondRecordingOverlay } from "./PondRecordingOverlay";
import { PondNamingOverlay } from "./PondNamingOverlay";
import type { NamingSession } from "./NamingRim";

export function MemoryPondPage({ arrival = 1, active = true, reducedMotion = false, recording = false, naming = null, onReady, onLeave, onNamingSaved, namingBackRef, covered = false, renderScene }: {
  /** Another step owns the controls while the pond stays mounted underneath. */
  covered?: boolean;
  /** Reuse a host scene, including its camera, wave clock, and ripple uniforms. */
  renderScene?: (props: PondProps) => ReactNode;
  arrival?: number; active?: boolean; reducedMotion?: boolean; recording?: boolean;
  /** The naming step: the memory just made hangs over this same water. */
  naming?: NamingSession | null;
  onReady?: () => void; onLeave?: () => void;
  /** The named memory is saved; the host takes the pond away and opens the gallery on it. */
  onNamingSaved?: (draftId: string) => void;
  /** Filled by the naming step with its way back down to the feeling step. */
  namingBackRef?: RefObject<(() => void) | null>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const overlaid = covered || recording || !!naming;
  const sinkRef = useRef(0);
  const [touch, setTouch] = useState<PondTouch | null>(null);
  const promptRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cueRef = useRef(pondPromptCue(0));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const hintReveal = useRef(0);
  const holdProgress = useRef(0);
  const [lifeReady, setLifeReady] = useState(() => overlaid || hasSeenPondInstruction());
  const enabled = active && arrival === 1 && !overlaid;
  const ready = useCallback(() => onReady?.(), [onReady]);
  const touchRef = useRef(touch);
  touchRef.current = touch;
  const hold = useHoldToCreate(() => {
    const at = touchRef.current;
    navigate(RECORD_START_PATH, { state: { ...location.state, focus: [at?.x ?? .5, at?.y ?? .65] } });
  }, enabled);
  holdProgress.current = hold.progress;
  const back = useCallback(() => (onLeave ?? (() => navigate(CAROUSEL_PATH)))(), [navigate, onLeave]);
  const setCursor = (e: { currentTarget: HTMLElement; clientX: number; clientY: number }) => {
    const r = e.currentTarget.getBoundingClientRect();
    cursorRef.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  // The first visit's prompts and hint wait for the heading to have appeared.
  useEffect(() => {
    if (!enabled || lifeReady) return;
    const timer = window.setTimeout(() => {
      markPondInstructionSeen();
      setLifeReady(true);
    }, reducedMotion ? 0 : POND_HEADING_DELAY_MS + TEXT_ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, lifeReady, reducedMotion]);
  useEffect(() => {
    let raf = 0, elapsed = 0, last = performance.now();
    const tick = (now: number) => {
      if (enabled && lifeReady && !document.hidden) elapsed += Math.min(50, now - last) / 1000;
      last = now;
      const cue = pondPromptCue(elapsed);
      cueRef.current = cue;
      promptRefs.current.forEach((label, i) => {
        if (!label) return;
        const opacity = enabled && i === cue.index ? cue.opacity : 0;
        label.style.opacity = String(opacity);
        label.style.translate = `0 ${reducedMotion ? 0 : cue.lift}px`;
        label.style.filter = reducedMotion ? "none" : `blur(${(1 - opacity) * 3}px)`;
        label.setAttribute("aria-hidden", String(opacity < .01));
        label.dataset.active = String(opacity > .01);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, lifeReady, reducedMotion]);
  useEffect(() => {
    if (!enabled || !lifeReady) {
      cursorRef.current = null;
      hintReveal.current = 0;
      if (hintRef.current) {
        hintRef.current.style.opacity = "0";
        hintRef.current.style.filter = "blur(6px)";
      }
      return;
    }
    let raf = 0, elapsed = 0, last = performance.now();
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(50, now - last);
      last = now;
      if (elapsed < 1500) hintReveal.current = 0;
      else {
        const t = Math.min(1, (elapsed - 1500) / (reducedMotion ? 1 : 720));
        hintReveal.current = t * t * (3 - 2 * t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, lifeReady, reducedMotion]);
  useEffect(() => {
    if (!overlaid) hold.reset();
  }, [overlaid, hold.reset]);
  useEffect(() => {
    if (!active) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "ArrowUp") return;
      if (naming) namingBackRef?.current?.();
      else if (recording) navigate(MEMORY_POND_PATH);
      else back();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [active, recording, naming, namingBackRef, back, navigate]);
  useEffect(() => {
    if (!enabled) return;
    buttonRef.current?.focus({ preventScroll: true });
  }, [enabled]);
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    // A long press on this full-screen button opens the iOS text magnifier
    // unless the touch itself is cancelled. The listener has to be non-passive.
    const stopMagnifier = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    el.addEventListener("touchstart", stopMagnifier, { passive: false });
    return () => el.removeEventListener("touchstart", stopMagnifier);
  }, [overlaid]);
  useEffect(() => {
    if (!enabled) return;
    let leftover = 0;
    let lockedUntil = 0;
    const wheel = (e: WheelEvent) => {
      if (holdProgress.current > 0) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      leftover += e.deltaY * unit;
      if (leftover > 0) leftover = 0;
      if (leftover > -72) return;
      leftover = 0;
      lockedUntil = now + (reducedMotion ? 80 : 140);
      back();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    return () => window.removeEventListener("wheel", wheel);
  }, [enabled, reducedMotion, back]);
  const pulseWater = useCallback((at: { x: number; y: number; strength: number }) => {
    setTouch({ ...at, serial: performance.now() });
  }, []);

  const pondProps: PondProps = { arrival, reducedMotion, touch, cursorRef, holdRef: holdProgress,
    hintRef, hintRevealRef: hintReveal, promptRefs, cueRef, onReady: ready, lifeReady,
    promptRipples: !overlaid && active, sinkRef };

  return <section aria-label={naming ? "name your memory" : recording ? "record a memory" : "a pond for a new memory"} data-pond-page data-pond-ready={enabled}
    style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(#ededE8, #e2e6e2 42%, #b6c8c3)", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
    {renderScene ? renderScene(pondProps) : <PerspectivePond {...pondProps} />}
    {!renderScene && <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 48% 24%, #fff9, transparent 58%)" }} />}

    {POND_THOUGHTS.map((thought, i) => <div key={thought.text} ref={el => { promptRefs.current[i] = el; }} data-pond-prompt={i} aria-hidden="true"
      style={{ position: "absolute", top: 0, left: 0, width: "min(148px, 42vw)", textAlign: "center", pointerEvents: "none", opacity: 0, transform: "translate(-50%, -100%) translate(50vw, 58vh)", transformOrigin: "center bottom", color: CHROME_GRAY, fontFamily: SANS, fontWeight: 400, fontSynthesis: "none", fontSize: POND_PROMPT_SIZE, lineHeight: 1.45, textShadow: "0 1px 16px #f3f4ece6", paddingBottom: 52 }}>
      {thought.text}
    </div>)}
    <PondHeading visible={enabled} reducedMotion={reducedMotion}>
      To create a new memory artifact, record yourself talking about a particular memory.
    </PondHeading>
    {!overlaid && <button ref={buttonRef} aria-label="Hold to begin" aria-describedby="pond-hold-help" disabled={!enabled}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
        setCursor(e);
        const r = e.currentTarget.getBoundingClientRect();
        setTouch({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, serial: performance.now() });
        hold.start();
      }}
      onPointerMove={e => {
        setCursor(e);
        if (!origin.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        if (Math.abs(dx) > 16 || Math.abs(dy) > 16) hold.cancel();
        if (dy < -70) {
          origin.current = null;
          hold.cancel();
          back();
        }
      }}
      onPointerLeave={() => { cursorRef.current = null; }}
      onPointerUp={() => { origin.current = null; hold.cancel(); }}
      onPointerCancel={() => { origin.current = null; cursorRef.current = null; hold.cancel(); }}
      onLostPointerCapture={() => { origin.current = null; hold.cancel(); }}
      onBlur={hold.cancel} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); hold.start(); } }}
      onKeyUp={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); hold.cancel(); } }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", touchAction: "none", cursor: "default", zIndex: 10, WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
      <span className="sr-only">Hold for two seconds, or hold Space or Enter. Release to cancel.</span>
    </button>}
    <div ref={hintRef} id="pond-hold-help" aria-hidden
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 20, opacity: 0, filter: "blur(6px)", whiteSpace: "nowrap", fontFamily: SANS, fontSize: INSTRUCTION_SIZE, letterSpacing: "0.01em", color: CHROME_GRAY, transformOrigin: "left top" }}>
      Hold to begin
    </div>
    {recording && <PondRecordingOverlay reducedMotion={reducedMotion} onVoicePulse={pulseWater} />}
    {naming && onNamingSaved && <PondNamingOverlay key={naming.draftId} session={naming} reducedMotion={reducedMotion} sinkRef={sinkRef} onSaved={onNamingSaved} backRef={namingBackRef} />}
    <span className="sr-only" role="status">{recording ? "ready to record" : ""}</span>
  </section>;
}

/** After the camera settles, a beat before the heading appears. */
const POND_HEADING_DELAY_MS = 300;

/** The pond's heading: it fades in where it rests, never travelling, a beat
 * after the camera has settled. The descent's floating photo wears the same. */
export function PondHeading({ visible, reducedMotion = false, children }: {
  visible: boolean; reducedMotion?: boolean; children: ReactNode;
}) {
  return <p aria-hidden style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) translateY(-20vh)",
    margin: 0,
    width: "min(28em, 86vw)",
    textAlign: "center",
    pointerEvents: "none",
    zIndex: 8,
    color: CHROME_GRAY,
    fontFamily: SERIF,
    fontWeight: 400,
    fontSynthesis: "none",
    fontSize: INSTRUCTION_SIZE,
    lineHeight: 1.45,
    opacity: visible ? 1 : 0,
    transition: reducedMotion ? "opacity 200ms ease"
      : visible ? `opacity ${TEXT_ENTER_MS}ms ease ${POND_HEADING_DELAY_MS}ms` : "opacity 400ms ease",
  }}>{children}</p>;
}
