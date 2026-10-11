import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router";
import { carouselFrame } from "../lib/carouselLayout";
import { POND_SINK, SINK_WASH, SURFACE_LIGHT, SURFACE_LIGHT_OUT_MS, pondSinkWash } from "../lib/pondCamera";
import { DESCENT_STEP_PATHS } from "../lib/routes";
import { VesselArtifact, vesselCanvasScale } from "../lab/VesselArtifact";
import type { Room } from "../lab/VesselPreview";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { draftArtifactOf, resumeColorState } from "../lib/namingDraft";
import { formKey } from "../lib/superformula";
import { CHROME_GRAY } from "../lib/colors";
import { FLOW_PAGE, NAMING_PROSE_SIZE, SANS, TRANSCRIPT } from "../lib/theme";
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
/**
 * How the memory's colour sits on the glass here. "gallery" is the gallery's
 * own way: a thin stain (.22) on one shoulder and its grazing edges, the face
 * and the far wall clear. "rim" gathers the colour all the way round the
 * silhouette and leaves the face clear. chroma scales the colour step's pick.
 */
type TintMode = "gallery" | "rim";
const NAMING_TINT = { mode: "gallery" as TintMode, stain: 0.22, chroma: 1 };
type NamingTint = typeof NAMING_TINT;

type NamingLight = typeof NAMING_LIGHT;
/** The naming page's own light, laid out for tuning: the room it reflects, then the glass. */
const LIGHT_SLIDERS: { key: keyof NamingLight; label: string; min: number; max: number; step: number; group: "light" | "glass" }[] = [
  { key: "envAbove", label: "sky light", min: 0, max: 1.5, step: 0.01, group: "light" },
  { key: "envBelow", label: "water light", min: 0, max: 1.5, step: 0.01, group: "light" },
  { key: "keyIntensity", label: "key", min: 0, max: 2, step: 0.01, group: "light" },
  { key: "thickDark", label: "thick dark", min: 0, max: 0.6, step: 0.01, group: "glass" },
  { key: "rim", label: "rim", min: 0, max: 1, step: 0.01, group: "glass" },
  { key: "highlight", label: "highlight", min: 0, max: 1, step: 0.01, group: "glass" },
];

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
  const artifactTop = `max(24px, calc(50% - ${frame.size / 2}px - ${FLOW_PAGE.namingArtifactRaise}))`;
  const [fieldDrop, setFieldDrop] = useState(0);
  const { state } = session;

  const washRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLParagraphElement>(null);
  const passage = (state.transcript ?? "").trim();
  const raf = useRef<number | null>(null);
  const leaving = useRef(false);

  const [rising] = useState(() => state.rise === true && !reducedMotion && !!sinkRef);
  const vesselReady = useRef(false);

  // The vessel, assigned form, photo, morph, colour and distance come from this branch's draft.
  const vessel = useMemo(() => galleryStateFor(draftArtifactOf(session)), [session]);
  const canvasRoom = useMemo(() => vesselCanvasScale(vessel.form, vessel.tune.morph), [vessel]);
  const [namingLight, setNamingLight] = useState<NamingLight>(NAMING_LIGHT);
  const [room, setRoom] = useState<Room>(NAMING_ROOM);
  const [tint, setTint] = useState<NamingTint>(NAMING_TINT);
  const lit = useMemo(() => ({
    ...vessel.tune, ...namingLight,
    ...(vessel.tune.memoryTintAmount > 0 ? {
      memoryTintAmount: tint.stain,
      memoryTintSpread: tint.mode === "rim" ? 1 : 0,
      memoryTintChroma: vessel.tune.memoryTintChroma * tint.chroma,
    } : {}),
  }), [vessel, namingLight, tint]);
  /** Where the memory is (1 = below its seat, in the water; 0 = in its seat) and how far it has appeared. */
  const liftRef = useRef(0);
  const appearRef = useRef(rising ? 0 : 1);

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
    const el = artifactRef.current;
    if (!el) return;
    el.style.transform = `translateY(${lift * LIFT_VH}vh)`;
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
      placeArtifact(Math.max(liftFrom, down), appearFrom * (1 - pondSinkWash(sink)), down * 4);
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
          transform: rising ? `translateY(${ARRIVE_SETTLE_VH}vh)` : "translateY(0)",
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
            tune={lit} room={room}
            glassMode={vessel.mode} sheetMode={vessel.sheetMode} face={vessel.face}
            sheetSize={vessel.tune.sheetSize}
            onReady={() => { vesselReady.current = true; }}
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

      <NamingLightPanel light={namingLight} room={room} tint={tint}
        onLight={(key, value) => setNamingLight(prev => ({ ...prev, [key]: value }))}
        onRoom={(key, value) => setRoom(prev => ({ ...prev, [key]: value }))}
        onTint={(key, value) => setTint(prev => ({ ...prev, [key]: value }))}
        onReset={() => { setNamingLight(NAMING_LIGHT); setRoom(NAMING_ROOM); setTint(NAMING_TINT); }} />

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

/** The naming page's light and colour, live: what settles here is what goes back into the constants. */
function NamingLightPanel({
  light, room, tint, onLight, onRoom, onTint, onReset,
}: {
  light: NamingLight;
  room: Room;
  tint: NamingTint;
  onLight: (key: keyof NamingLight, value: number) => void;
  onRoom: (key: keyof Room, value: string) => void;
  onTint: <K extends keyof NamingTint>(key: K, value: NamingTint[K]) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"light" | "colour">("light");
  const copy = () => {
    const nums = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(", ");
    const text = `const NAMING_ROOM = { above: "${room.above}", below: "${room.below}" };\nconst NAMING_LIGHT = { ${nums(light)} };\nconst NAMING_TINT = { mode: "${tint.mode}" as TintMode, stain: ${tint.stain}, chroma: ${tint.chroma} };`;
    void navigator.clipboard?.writeText(text);
  };
  const tabButton = (id: "light" | "colour") => (
    <button type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
      style={{ ...TEXT_BUTTON, textDecoration: tab === id ? "underline" : "none", opacity: tab === id ? 1 : 0.55 }}>{id}</button>
  );
  const modeButton = (id: TintMode, label: string) => (
    <button type="button" onClick={() => onTint("mode", id)} aria-pressed={tint.mode === id}
      style={{ ...TEXT_BUTTON, textDecoration: tint.mode === id ? "underline" : "none", opacity: tint.mode === id ? 1 : 0.55 }}>{label}</button>
  );
  const row = (label: string, control: ReactNode, value: string) => (
    <label key={label} style={{ display: "grid", gridTemplateColumns: "78px 1fr 42px", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span>{label}</span>
      {control}
      <span style={{ textAlign: "right" }}>{value}</span>
    </label>
  );
  const slider = (value: number, min: number, max: number, step: number, onChange: (v: number) => void) => (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: CHROME_GRAY, cursor: "ew-resize" }} />
  );
  return (
    <div style={{ position: "absolute", top: 88, right: 24, zIndex: 4, width: 248, pointerEvents: "auto",
      color: CHROME_GRAY, fontFamily: SANS, fontSize: 12, lineHeight: 1.2 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>{tabButton("light")}{tabButton("colour")}</div>
      {tab === "light" && <>
        <p style={{ margin: "0 0 2px" }}>light</p>
        {row("sky", <input type="color" aria-label="sky colour" value={room.above} onChange={e => onRoom("above", e.target.value)} />, room.above)}
        {row("water", <input type="color" aria-label="water colour" value={room.below} onChange={e => onRoom("below", e.target.value)} />, room.below)}
        {LIGHT_SLIDERS.filter(s => s.group === "light").map(s => row(s.label, slider(light[s.key], s.min, s.max, s.step, v => onLight(s.key, v)), light[s.key].toFixed(2)))}
        <p style={{ margin: "16px 0 2px" }}>glass</p>
        {LIGHT_SLIDERS.filter(s => s.group === "glass").map(s => row(s.label, slider(light[s.key], s.min, s.max, s.step, v => onLight(s.key, v)), light[s.key].toFixed(2)))}
      </>}
      {tab === "colour" && <>
        <p style={{ margin: "0 0 6px" }}>where the colour sits</p>
        <div style={{ display: "flex", gap: 14 }}>{modeButton("gallery", "one shoulder, as the gallery")}{modeButton("rim", "round the rim")}</div>
        <p style={{ margin: "8px 0 0", opacity: 0.7, lineHeight: 1.4 }}>
          {tint.mode === "gallery"
            ? "a thin stain on one shoulder and its grazing edges; the face and the far wall stay clear."
            : "the colour gathers all the way round where the wall turns edge-on; the face stays clear."}
        </p>
        {row("stain", slider(tint.stain, 0, 1, 0.01, v => onTint("stain", v)), tint.stain.toFixed(2))}
        {row("chroma", slider(tint.chroma, 0, 3, 0.05, v => onTint("chroma", v)), `×${tint.chroma.toFixed(2)}`)}
      </>}
      <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
        <button type="button" onClick={copy} style={TEXT_BUTTON}>copy values</button>
        <button type="button" onClick={onReset} style={TEXT_BUTTON}>reset</button>
      </div>
    </div>
  );
}

const TEXT_BUTTON: CSSProperties = {
  border: 0, padding: 0, background: "none", color: "inherit", font: "inherit",
  textDecoration: "underline", cursor: "pointer",
};
