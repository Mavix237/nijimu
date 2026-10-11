import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useNavigate } from "react-router";
import { carouselFrame } from "../lib/carouselLayout";
import { surfaceReturnBlurAt } from "../lib/ascentLight";
import { POND_SINK, SINK_WASH, SURFACE_LIGHT, SURFACE_LIGHT_OUT_MS, pondSinkWash } from "../lib/pondCamera";
import { DESCENT_STEP_PATHS } from "../lib/routes";
import { VesselArtifact, vesselCanvasScale } from "../lab/VesselArtifact";
import { DISTANCE_FAR, type Room } from "../lab/VesselPreview";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { draftArtifactOf, resumeColorState } from "../lib/namingDraft";
import { formKey } from "../lib/superformula";
import { CHROME_GRAY } from "../lib/colors";
import { FLOW_PAGE, NAMING_PROSE_SIZE, TRANSCRIPT } from "../lib/theme";
import { FlowPageGrid } from "./FlowPageGrid";
import { MemoryReadingPane, type ReadableMemory } from "./MemoryReadingPane";
import { useCompact } from "../hooks/useCompact";
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
 * typed above the transcript, with the vessel below the words. The content
 * stays inside the scene row, leaving the save action clear. A phone has no
 * room for the words: the vessel takes their place under the fields, and
 * pressing it opens them in a reading pane (as the gallery does there).
 */

/** Air left between the year and the scene content. */
const FIELD_GAP = 28;
/** The name, year and transcript rise further than the vessel. */
const TEXT_LIFT = "6vh";
/** The vessel sits this far above the seat the words leave it. */
const ARTIFACT_LIFT = "3vh";
/** A little larger than the gallery seat, on this page only. */
const ARTIFACT_SCALE = 1.25;
/** Going back down: the words leave first, then the eye sinks. */
const CHROME_OUT_MS = 420;
/** How far below its seat the memory sinks when going back, as a share of the viewport height. */
const LIFT_VH = 22;
/**
 * Arriving from the descent: the ascent there ended in light, and this step
 * opens out of the same light — the frame clears from white and sharpens,
 * the eye settling the last little way up to the pond, the memory already in
 * its seat and coming into focus with the rest.
 */
const ARRIVE_SINK = 0.3;
const ARRIVE_BLUR_PX = 22;
const ARRIVE_SETTLE_VH = 3;
/**
 * The glass lit as this scene is lit, not as the gallery's grey wall: the
 * pale warm sky over it, the bright water under it, and a thinner, lighter
 * body — the gallery's thick-dark feet and rim read as a grey ball over
 * this much light. The memory's own stain stays in its tune.
 */
const NAMING_ROOM: Room = { above: "#f3f3ee", below: "#e6e6e6" };
const NAMING_LIGHT = { envAbove: 1.09, envBelow: 1.09, thickDark: 0.06, rim: 0.67, highlight: 1, keyIntensity: 1.41 };
/** The same light for a memory at far & faded: the key gone, the sky dimmer, the rim a little quieter. */
const NAMING_LIGHT_FAR: NamingLight = { envAbove: 0.9, envBelow: 1.09, thickDark: 0.06, rim: 0.6, highlight: 1, keyIntensity: 0 };
/** The light at a memory's distance: near & clear is NAMING_LIGHT, far & faded NAMING_LIGHT_FAR, evenly between. */
function namingLightAt(haze: number): NamingLight {
  const t = clamp01(haze / DISTANCE_FAR);
  const out = { ...NAMING_LIGHT };
  for (const k of Object.keys(out) as (keyof NamingLight)[]) out[k] = NAMING_LIGHT[k] + (NAMING_LIGHT_FAR[k] - NAMING_LIGHT[k]) * t;
  return out;
}
/** The colour gathers around the rim, where the wall turns edge-on, and the face stays clear. */
const NAMING_STAIN = 0.36;

type NamingLight = typeof NAMING_LIGHT;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

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
  const contentTop = `max(24px, calc(50% - ${frame.size / 2}px - ${FLOW_PAGE.namingArtifactRaise}))`;
  const [fieldDrop, setFieldDrop] = useState(0);
  const { state } = session;

  const washRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLParagraphElement>(null);
  const passage = (state.transcript ?? "").trim();
  const compact = useCompact();
  /** The words under the fields, on wider screens; a phone keeps them in the pane. */
  const inlinePassage = compact ? "" : passage;
  const [reading, setReading] = useState(false);
  const readable = useMemo<ReadableMemory | null>(
    () => (reading ? { id: session.draftId, transcript: passage } : null),
    [reading, session.draftId, passage],
  );
  const openWords = compact && passage ? () => setReading(true) : undefined;
  const raf = useRef<number | null>(null);
  const leaving = useRef(false);

  const [rising] = useState(() => state.rise === true && !reducedMotion && !!sinkRef);
  const vesselReady = useRef(false);

  // The vessel, assigned form, photo, morph, colour and distance come from this branch's draft.
  const vessel = useMemo(() => galleryStateFor(draftArtifactOf(session)), [session]);
  const canvasRoom = useMemo(() => vesselCanvasScale(vessel.form, vessel.tune.morph), [vessel]);
  const namingLight = useMemo(() => namingLightAt(vessel.tune.haze), [vessel]);
  const lit = useMemo(() => ({
    ...vessel.tune, ...namingLight,
    ...(vessel.tune.memoryTintAmount > 0 ? { memoryTintAmount: NAMING_STAIN, memoryTintSpread: 1 } : {}),
  }), [vessel, namingLight]);
  /** Where the memory is (1 = below its seat, in the water; 0 = in its seat) and how far it has appeared. */
  const liftRef = useRef(0);
  const appearRef = useRef(rising ? 0 : 1);
  const blurRef = useRef(0);

  /** The water and the words, at a depth of the eye: under the wash below the surface, settled above it. */
  const pose = (sink: number) => {
    const wash = pondSinkWash(sink);
    if (washRef.current) washRef.current.style.opacity = String(wash);
    if (chromeRef.current) chromeRef.current.style.opacity = String(1 - smooth(sink / 0.4));
  };
  const showPassage = (opacity: number) => {
    if (passageRef.current) passageRef.current.style.opacity = String(opacity);
  };
  const placeArtifact = (lift: number, appear: number, blurPx = 0) => {
    liftRef.current = lift;
    appearRef.current = appear;
    blurRef.current = blurPx;
    const el = artifactRef.current;
    if (!el) return;
    el.style.transform = `translateY(calc(${lift * LIFT_VH}vh - ${ARTIFACT_LIFT}))`;
    el.style.opacity = String(clamp01(appear));
    el.style.filter = blurPx > 0.02 ? `blur(${blurPx.toFixed(2)}px)` : "";
  };
  /** The light over everything: how much of it is left, and how blurred what is under it is. */
  const light = (left: number) => {
    const el = lightRef.current;
    if (!el) return;
    el.style.opacity = String(clamp01(left));
    const filter = left > 0.002 ? `blur(${(ARRIVE_BLUR_PX * left).toFixed(1)}px)` : "";
    el.style.backdropFilter = filter;
    el.style.setProperty("-webkit-backdrop-filter", filter);
  };

  // The heading row stays put. Its fields stop short of the transcript
  // and vessel stack, so editing never shifts the scene.
  useLayoutEffect(() => {
    const place = () => {
      const heading = chromeRef.current;
      const content = contentRef.current;
      const scene = content?.offsetParent as HTMLElement | null;
      if (!heading || !content || !scene) return;
      const contentEdge = scene.offsetTop + content.offsetTop;
      const headingBottom = heading.offsetTop + heading.offsetHeight;
      setFieldDrop(Math.max(0, contentEdge - FIELD_GAP - headingBottom));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [frame.size, viewport.w, viewport.h]);

  // Before the first frame: the frame is the light the ascent ended in. Once
  // the vessel has drawn, the light clears and sharpens, the eye settles the
  // last little way up to the pond, and the memory comes into focus in its seat.
  useLayoutEffect(() => {
    if (!rising || !sinkRef) return;
    sinkRef.current = ARRIVE_SINK;
    pose(ARRIVE_SINK);
    light(1);
    showPassage(0);
    placeArtifact(ARRIVE_SETTLE_VH / LIFT_VH, 0, ARRIVE_BLUR_PX * 0.4);
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (!document.hidden && vesselReady.current) elapsed += Math.min(50, now - last);
      last = now;
      const p = Math.min(1, elapsed / SURFACE_LIGHT_OUT_MS);
      const out = smooth(p);
      const sink = ARRIVE_SINK * (1 - out);
      sinkRef.current = sink;
      pose(sink);
      light(1 - out);
      placeArtifact((1 - out) * ARRIVE_SETTLE_VH / LIFT_VH, smooth(p / 0.7), ARRIVE_BLUR_PX * 0.4 * (1 - out));
      showPassage(smooth(p));
      if (p >= 1) {
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
    const appearFrom = appearRef.current;
    const blurFrom = blurRef.current;
    light(0);
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(50, now - last);
      last = now;
      const sink = sinkFrom + (1 - sinkFrom) * clamp01((elapsed - CHROME_OUT_MS) / POND_SINK.durationMs);
      sinkRef.current = sink;
      pose(sink);
      // it goes back into the water as the eye does, and is lost in the wash
      const down = smooth(sink);
      const chrome = 1 - clamp01(elapsed / CHROME_OUT_MS);
      placeArtifact(Math.max(liftFrom, down), appearFrom * (1 - pondSinkWash(sink)),
        Math.max(blurFrom * (1 - smooth(elapsed / CHROME_OUT_MS)), surfaceReturnBlurAt(sink)));
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
      {/* The light the ascent ended in; the step opens out of it. */}
      {rising && <div ref={lightRef} aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none", background: SURFACE_LIGHT, opacity: 1 }} />}

      {/* Naming is content, not navigation: it shares the step-heading row. */}
      <FlowPageGrid headingRef={chromeRef} heading={rim.caption}
        scene={<div ref={contentRef} style={{ position: "absolute", top: contentTop, bottom: 12,
          left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: inlinePassage ? 28 : 0 }}>
        {inlinePassage && (
          <p
            ref={passageRef}
            style={{
              ...TRANSCRIPT,
              fontSize: NAMING_PROSE_SIZE,
              lineHeight: 1.55,
              flex: "0 1 auto",
              minHeight: 0,
              maxHeight: "45%",
              overflowY: "auto",
              width: "min(80ch, calc(100vw - 40px))",
              maxWidth: "80ch",
              margin: 0,
              color: CHROME_GRAY,
              textAlign: "center",
              opacity: rising ? 0 : 1,
              transform: `translateY(-${TEXT_LIFT})`,
              pointerEvents: "auto",
              zIndex: 1,
            }}
          >
            {inlinePassage}
          </p>
        )}
        <div style={{ flex: "1 1 0", minHeight: 0, width: "100%" }}>
        <div
        ref={artifactRef}
        {...(openWords ? {
          role: "button", tabIndex: 0, "aria-label": "the memory being made — read its words",
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWords(); }
          },
        } : { role: "img", "aria-label": "the memory being made" })}
        style={{
          position: "relative",
          height: "100%",
          maxHeight: frame.size * ARTIFACT_SCALE,
          maxWidth: "100%",
          aspectRatio: "1",
          margin: "0 auto",
          transform: rising ? `translateY(calc(${ARRIVE_SETTLE_VH}vh - ${ARTIFACT_LIFT}))` : `translateY(-${ARTIFACT_LIFT})`,
          opacity: rising ? 0 : 1,
          willChange: "transform, opacity, filter",
          pointerEvents: "auto",
          zIndex: 1,
        }}
      >
        <div style={{ position: "absolute", inset: `${(1 - canvasRoom) * 50}%` }}>
          <VesselArtifact
            cacheKey={`${session.draftId}|naming|${formKey(vessel.form)}|${vessel.tune.morph}`}
            form={vessel.form} morph={vessel.tune.morph}
            photoUrl={vessel.url || undefined} seed={vessel.seed}
            tune={lit} room={NAMING_ROOM}
            glassMode={vessel.mode} sheetMode={vessel.sheetMode} face={vessel.face}
            sheetSize={vessel.tune.sheetSize}
            onReady={() => { vesselReady.current = true; }}
            focused still={false} frameloop="always"
            onPick={openWords}
          />
        </div>
      </div>
        </div>
        </div>}
        actions={rim.actions}
        // raised to the surface's action row; the scene keeps its rows, so the vessel stays put
        actionsStyle={{ transform: `translateY(-${FLOW_PAGE.surfaceActionLift})` }}
        headingStyle={{ opacity: rising ? 0 : 1, display: "flex", justifyContent: "center",
          transform: `translateY(calc(${fieldDrop}px - ${TEXT_LIFT}))`,
          ["--naming-field" as string]: "min(28em, calc(100vw - 40px))" }}
        style={{ zIndex: 1 }} />

      {/* the overlay lets presses through to the water; the pane takes its own */}
      {compact && passage && <div style={{ pointerEvents: "auto" }}>
        <MemoryReadingPane memory={readable} onClose={() => setReading(false)} />
      </div>}

      <div
        ref={washRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: SINK_WASH,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
