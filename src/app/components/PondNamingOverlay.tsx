import { takeSurfaceFrame } from "../lib/surfaceHandoff";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router";
import { carouselFrame } from "../lib/carouselLayout";
import { POND_SINK, SINK_WASH, pondSinkWash } from "../lib/pondCamera";
import { DESCENT_STEP_PATHS } from "../lib/routes";
import { VesselArtifact, vesselCanvasScale } from "../lab/VesselArtifact";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { draftArtifactOf, resumeColorState } from "../lib/namingDraft";
import { formKey } from "../lib/superformula";
import { ARTIFACT_LIGHT, useArtifactGlow } from "./ArtifactGlow";
import { CHROME_GRAY } from "../lib/colors";
import { FLOW_PAGE, NAMING_PROSE_SIZE, TRANSCRIPT } from "../lib/theme";
import { FlowPageGrid } from "./FlowPageGrid";
import {
  useNamingRim,
  type NameFlowState,
  type NamingSession,
} from "./NamingRim";

/*
 * The naming step, back above the water. The eye has come up from where the
 * memory was made and stands at the pond again, in the same place it stood to
 * speak; the memory has risen with it and hangs in the air over the water,
 * centred, turning, in the gallery's own glass. The name and the year are
 * typed above it. They keep the shared heading row for layout, then drop
 * part of the way toward the glass, so a taller window does not leave them
 * stranded under the wordmark.
 */

/** Air left between the year and the top of the vessel's frame. */
const FIELD_GAP = 48;

/** The eye comes up through the water, then the step arrives. */
const RISE_MS = POND_SINK.durationMs * 1.2;
/** The memory comes up behind the eye, slower, and lands after it has settled. */
const ARTIFACT_RISE_MS = RISE_MS * 1.5;
/** Going back down: the words leave first, then the eye sinks. */
const CHROME_OUT_MS = 420;
/** Spoken words under the vessel — only after it has come to rest. */
const PASSAGE_IN_MS = 480;
/** How far the memory travels on the way up, as a share of the viewport height. */
const LIFT_VH = 18;
/**
 * Its light along its own way up (0 = surfacing, 1 = landed): the wash's
 * colour at first, turning gradually to full white, then the white fading
 * back off to leave the glass — all well before it comes to rest.
 */
const WHITEN_FROM = 0.2;
const WHITE_AT = 0.4;
const CLEAR_FROM = 0.47;
const GLASS_AT = 0.74;
/** Going back down, whatever light is left goes out over this long. */
const LIGHT_OUT_MS = 600;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

function lightAt(p: number) {
  const whiten = 0.65 + 0.35 * smooth((p - WHITEN_FROM) / (WHITE_AT - WHITEN_FROM));
  const clear = smooth((p - CLEAR_FROM) / (GLASS_AT - CLEAR_FROM));
  return { fill: 1 - clear, white: whiten * (1 - clear) };
}

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

export function PondNamingOverlay({
  session,
  reducedMotion = false,
  sinkRef,
  onSaved,
  backRef,
}: {
  session: NamingSession;
  reducedMotion?: boolean;
  /** Shared with the water: 1 is under it, 0 is standing at the pond. */
  sinkRef?: RefObject<number>;
  /** The memory is in the store; the host takes the pond away and opens the gallery on it. */
  onSaved: (draftId: string) => void;
  /** The host's back control calls this: the eye sinks back down to the feeling step. */
  backRef?: RefObject<(() => void) | null>;
}) {
  const navigate = useNavigate();
  const viewport = useViewport();
  const frame = carouselFrame(viewport.w, viewport.h);
  const artifactTop = `max(24px, calc(50% - ${frame.size / 2}px - ${FLOW_PAGE.namingArtifactRaise}))`;
  const [fieldDrop, setFieldDrop] = useState(0);
  const { state } = session;

  const washRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLParagraphElement>(null);
  const passage = (state.transcript ?? "").trim();
  const raf = useRef<number | null>(null);
  const leaving = useRef(false);

  const [rising] = useState(() => state.rise === true && !reducedMotion && !!sinkRef);
    const vesselReady = useRef(false);
  const [handoff, setHandoff] = useState(takeSurfaceFrame);
  const [handoffDone, setHandoffDone] = useState(false);
  const handoffRef = useRef<HTMLImageElement>(null);

  // Nicole's transition supplies only motion and light. The vessel, assigned
  // form, photo, morph, colour and distance come from this branch's draft.
  const vessel = useMemo(() => galleryStateFor(draftArtifactOf(session)), [session]);
  const canvasRoom = useMemo(() => vesselCanvasScale(vessel.form, vessel.tune.morph), [vessel]);
  const glow = useArtifactGlow(ARTIFACT_LIGHT, 0.5);
  /** Where the memory is on its way up (1 = still below, 0 = in its seat), and its light. */
  const liftRef = useRef(rising ? 1 : 0);
  const lightRef = useRef(rising ? { fill: 1, white: 0.65 } : { fill: 0, white: 0 });

  /** The water and the words, at a depth of the eye: under the wash below the surface, settled above it. */
  const pose = (sink: number) => {
    const wash = pondSinkWash(sink);
    if (washRef.current) washRef.current.style.opacity = String(wash);
    if (chromeRef.current) chromeRef.current.style.opacity = String(1 - smooth(sink / 0.4));
  };
  const showPassage = (opacity: number) => {
    if (passageRef.current) passageRef.current.style.opacity = String(opacity);
  };
  const placeArtifact = (lift: number, light: { fill: number; white: number }) => {
    liftRef.current = lift;
    lightRef.current = light;
    if (artifactRef.current) artifactRef.current.style.transform = `translateY(${lift * LIFT_VH}vh)`;
    glow.apply(artifactRef.current, light.fill, light.white);
  };

  // The heading row stays put, so the vessel does not move. The fields
  // themselves travel down, stopping short of the glass.
  useLayoutEffect(() => {
    const place = () => {
      const heading = chromeRef.current;
      const artifact = artifactRef.current;
      const scene = artifact?.offsetParent as HTMLElement | null;
      if (!heading || !artifact || !scene) return;
      const artifactEdge = scene.offsetTop + artifact.offsetTop;
      const headingBottom = heading.offsetTop + heading.offsetHeight;
      setFieldDrop(Math.max(0, artifactEdge - FIELD_GAP - headingBottom));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [frame.size, viewport.w, viewport.h]);

  // Before the first frame: the camera starts where the shape scene left it,
  // just under the surface, behind the same wash. The memory comes up after
  // it, slower, still the light it turned into below; on the way its light
  // whitens, then fades off to leave the glass before it comes to rest.
  useLayoutEffect(() => {
    if (!rising || !sinkRef) return;
    sinkRef.current = 1;
    pose(1);
    placeArtifact(1, { fill: 1, white: 0.65 });
    showPassage(0);
    if (handoff?.artifactOnly) glow.apply(handoffRef.current, 1, .65);
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (!document.hidden && vesselReady.current) elapsed += Math.min(50, now - last);
      last = now;
      const sink = 1 - Math.min(1, elapsed / RISE_MS);
      sinkRef.current = sink;
      pose(sink);
      const way = Math.min(1, elapsed / ARTIFACT_RISE_MS);
      placeArtifact(1 - smooth(way), lightAt(way));
      // Held at 0 until the vessel is in its seat; then it fades in.
      showPassage(way >= 1 ? smooth((elapsed - ARTIFACT_RISE_MS) / PASSAGE_IN_MS) : 0);
      if (way >= 1 && elapsed - ARTIFACT_RISE_MS >= PASSAGE_IN_MS) {
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [rising, sinkRef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (sinkRef) sinkRef.current = 0;
  }, [sinkRef]);

  // Back is the way here in reverse: the words go, the eye sinks through the
  // surface with the memory, and the feeling step takes over the descent.
  const sinkBack = (flow: NameFlowState) => {
    if (leaving.current) return;
    leaving.current = true;
    const go = () => navigate(DESCENT_STEP_PATHS.color, { state: resumeColorState({ ...flow, memoryId: flow.memoryId ?? session.draftId }) });
    if (reducedMotion || !sinkRef) {
      go();
      return;
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    // If it hadn't quite landed, it goes down from where it was.
    const sinkFrom = sinkRef.current;
    const liftFrom = liftRef.current;
    const lightFrom = lightRef.current;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(50, now - last);
      last = now;
      const sink = sinkFrom + (1 - sinkFrom) * clamp01((elapsed - CHROME_OUT_MS) / POND_SINK.durationMs);
      sinkRef.current = sink;
      pose(sink);
      const out = 1 - smooth(elapsed / LIGHT_OUT_MS);
      placeArtifact(Math.max(liftFrom, smooth(sink)), { fill: lightFrom.fill * out, white: lightFrom.white * out });
      const chrome = 1 - clamp01(elapsed / CHROME_OUT_MS);
      if (chromeRef.current) chromeRef.current.style.opacity = String(chrome);
      showPassage(chrome);
      if (sink >= 1) { raf.current = null; go(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const rim = useNamingRim(session, reducedMotion, {
    actionsInGrid: true,
    onSaved: (id) => {
      leaving.current = true;
      onSaved(id);
    },
    onExit: sinkBack,
  });

  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => rim?.exit();
    return () => { backRef.current = null; };
  });

  if (!rim) return null;

  return (
    <div className="absolute inset-0 select-none" style={{ zIndex: 30, pointerEvents: "none" }}>
      {glow.filter}

      {handoff && <img ref={handoffRef} src={handoff.url} alt="" aria-hidden
        onTransitionEnd={() => { if (handoffDone) setHandoff(null); }}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 2,
          pointerEvents: "none", opacity: handoffDone ? 0 : 1, transition: "opacity 450ms ease" }} />}

      {/* Naming is content, not navigation: it shares the step-heading row. */}
      <FlowPageGrid headingRef={chromeRef} heading={rim.caption}
        scene={<>
        <div
        ref={artifactRef}
        role="img"
        aria-label="the memory being made"
        style={{
          position: "absolute",
          left: `calc(50% - ${frame.size / 2}px)`,
          top: artifactTop,
          width: frame.size,
          height: frame.size,
          transform: rising ? `translateY(${LIFT_VH}vh)` : "translateY(0)",
          willChange: "transform",
          pointerEvents: "auto",
          zIndex: 1,
        }}
      >
        <div style={{ position: "absolute", inset: `${(1 - canvasRoom) * 50}%` }}>
          <VesselArtifact
            cacheKey={`${session.draftId}|naming|${formKey(vessel.form)}|${vessel.tune.morph}`}
            form={vessel.form} morph={vessel.tune.morph}
            photoUrl={vessel.url || undefined} seed={vessel.seed}
            tune={vessel.tune} room={vessel.room}
            glassMode={vessel.mode} sheetMode={vessel.sheetMode} face={vessel.face}
            sheetSize={vessel.tune.sheetSize}
            onReady={() => { vesselReady.current = true; setHandoffDone(true); }}
            focused still={false} frameloop="always"
          />
        </div>
      </div>
        {passage && (
          <p
            ref={passageRef}
            style={{
              ...TRANSCRIPT,
              fontSize: NAMING_PROSE_SIZE,
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: `calc(${artifactTop} + ${frame.size + 28}px)`,
              width: "min(80ch, calc(100vw - 40px))",
              maxWidth: "80ch",
              margin: 0,
              color: CHROME_GRAY,
              textAlign: "center",
              opacity: rising ? 0 : 1,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {passage}
          </p>
        )}
        </>}
        actions={rim.actions}
        headingStyle={{ opacity: rising ? 0 : 1, display: "flex", justifyContent: "center",
          transform: `translateY(${fieldDrop}px)`,
          ["--naming-field" as string]: "min(28em, calc(100vw - 40px))" }}
        style={{ zIndex: 1 }} />

      <div
        ref={washRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: SINK_WASH,
          opacity: rising ? 1 : 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
