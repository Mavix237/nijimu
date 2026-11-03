import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { draftArtifactOf } from "../lib/namingDraft";
import {
  SURFACE_DEFAULT, SURFACE_RANGE, TONAL_CONTRAST, copyArtifactFrame, downloadMemoryImage, keepGrainSettings, keepSurfaceSettings,
  keepTonalContrast, memoryCard, pngOf, readGrainSettings, readSurfaceSettings, readTonalContrast, type SurfaceSettings,
} from "../lib/memoryImage";
import { GRAIN_INTENSITY, GRAIN_KINDS, GRAIN_SIZE, GrainStudy, type GrainKind, type GrainSettings } from "../lib/filmGrain";
import { CHROME_GRAY } from "../lib/colors";
import { SANS } from "../lib/theme";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { withNamingLights } from "../lib/namingTune";
import { VesselArtifact } from "../lab/VesselArtifact";
import type { NamingSession } from "./NamingRim";

type Zoom = "fit" | 1 | 2 | 4;
const ZOOMS: readonly { value: Zoom; label: string }[] = [
  { value: "fit", label: "fit" },
  { value: 1, label: "100%" },
  { value: 2, label: "200%" },
  { value: 4, label: "400%" },
];
/** Room kept under the image for the controls. */
const PANEL_SPACE = 240;
const TOP_SPACE = 56;

/** The card as composed (never written to) and its grains. */
type Card = { source: ImageData; study: GrainStudy };
type Job = { frame: HTMLCanvasElement; contrast: number; surface: SurfaceSettings };

/**
 * The downloaded card, shown over the naming step so the room, its light and
 * the grain can be judged without leaving the page. It is composed the same
 * way the download is: the vessel drawn off screen once, then laid into the
 * card — again for every change of the tonal contrast, from the same frame.
 * The grain is laid over that card's own pixels at full size; switching
 * treatments re-grains the same pixels and leaves the view where it was.
 */
export function MemoryImagePreview({ session, title, year, onClose }: {
  session: NamingSession;
  title: string;
  year: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState<HTMLCanvasElement | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [contrast, setContrast] = useState(readTonalContrast);
  const [surface, setSurface] = useState<SurfaceSettings>(readSurfaceSettings);
  const [grain, setGrain] = useState<GrainSettings>(readGrainSettings);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [original, setOriginal] = useState(false);
  const [holding, setHolding] = useState(false);
  const taken = useRef(-1);
  const composing = useRef(false);
  const pending = useRef<Job | null>(null);
  const alive = useRef(true);
  const view = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const out = useRef<ImageData | null>(null);
  const centre = useRef<[number, number] | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const vessel = useMemo(() => {
    const state = galleryStateFor(draftArtifactOf(session));
    return { ...state, tune: withNamingLights(state.tune) };
  }, [session]);
  const tone = useMemo(() => vessel.tune.memoryTintAmount > 0
    ? { l: vessel.tune.memoryTintLight, c: vessel.tune.memoryTintChroma, h: vessel.tune.memoryTintHue }
    : undefined, [vessel]);
  const showOriginal = original || holding;

  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    const typing = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      return !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range"));
    };
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "o" || event.key === "O") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setHolding(true);
        return;
      }
      const index = "01234".indexOf(event.key);
      if (index >= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setGrain((g) => ({ ...g, kind: GRAIN_KINDS[index].kind }));
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "o" || event.key === "O") setHolding(false);
    };
    const blur = () => setHolding(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    };
  }, [onClose]);

  useEffect(() => { keepGrainSettings(grain); }, [grain]);
  useEffect(() => { keepSurfaceSettings(surface); }, [surface]);

  // One composition at a time; a slider moved meanwhile is composed next, at its latest value.
  const compose = async (job: Job) => {
    if (composing.current) { pending.current = job; return; }
    composing.current = true;
    try {
      const canvas = await memoryCard(job.frame, title, year, session.state.transcript ?? "", tone, job.contrast, job.surface);
      if (!alive.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image canvas unavailable");
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCard({ source, study: new GrainStudy(source) });
      setError(null);
    } catch {
      if (alive.current) setError("the image couldn’t be prepared");
    } finally {
      composing.current = false;
      const queued = pending.current;
      pending.current = null;
      if (queued && alive.current) void compose(queued);
    }
  };

  useEffect(() => {
    if (frame) void compose({ frame, contrast, surface });
  }, [frame, contrast, surface]);

  // The view: the card's own pixels, or the same pixels grained, drawn once a frame at most.
  useEffect(() => {
    const canvas = view.current;
    if (!card || !canvas) return;
    const id = requestAnimationFrame(() => {
      const { source, study } = card;
      if (canvas.width !== source.width || canvas.height !== source.height) {
        canvas.width = source.width;
        canvas.height = source.height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (showOriginal || grain.kind === "off") {
        ctx.putImageData(source, 0, 0);
        return;
      }
      if (!out.current || out.current.width !== source.width || out.current.height !== source.height) {
        out.current = ctx.createImageData(source.width, source.height);
      }
      study.render(grain, out.current);
      ctx.putImageData(out.current, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [card, grain, showOriginal]);

  // A new zoom keeps the point at the middle of the view where it was.
  useLayoutEffect(() => {
    const at = centre.current, v = viewport.current, c = view.current;
    centre.current = null;
    if (!at || !v || !c) return;
    const r = c.getBoundingClientRect(), vr = v.getBoundingClientRect();
    v.scrollLeft += r.left + at[0] * r.width - (vr.left + vr.width / 2);
    v.scrollTop += r.top + at[1] * r.height - (vr.top + vr.height / 2);
  }, [zoom]);

  const changeZoom = (next: Zoom) => {
    const v = viewport.current, c = view.current;
    if (v && c) {
      const r = c.getBoundingClientRect(), vr = v.getBoundingClientRect();
      const clamp = (x: number) => Math.min(1, Math.max(0, x));
      centre.current = [clamp((vr.left + vr.width / 2 - r.left) / r.width), clamp((vr.top + vr.height / 2 - r.top) / r.height)];
    }
    setZoom(next);
  };

  const capture = (canvas: HTMLCanvasElement, generation: number) => {
    if (taken.current === generation) return;
    taken.current = generation;
    try {
      setFrame(copyArtifactFrame(canvas));
    } catch {
      setError("the image couldn’t be prepared");
    }
  };

  const again = () => {
    setError(null);
    setFrame(null);
    setAttempt((n) => n + 1);
  };

  const changeContrast = (percent: number) => {
    const value = Math.min(TONAL_CONTRAST.max, Math.max(TONAL_CONTRAST.min, percent / 100));
    setContrast(value);
    keepTonalContrast(value);
  };

  // The file is the card at full size with the chosen grain — the same pass the download makes.
  const download = async () => {
    if (!card) return;
    const canvas = document.createElement("canvas");
    canvas.width = card.source.width;
    canvas.height = card.source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    card.study.render(grain, pixels);
    ctx.putImageData(pixels, 0, 0);
    downloadMemoryImage(await pngOf(canvas), title);
  };

  const capturing = !frame && !error;
  const percent = Math.round(contrast * 100);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const zoomed = zoom !== "fit";
  const canvasStyle = zoom === "fit"
    ? { maxWidth: "calc(100vw - 48px)", maxHeight: `calc(100dvh - ${TOP_SPACE + PANEL_SPACE + 12}px)` }
    : card
      ? { width: (card.source.width * zoom) / dpr, height: (card.source.height * zoom) / dpr, imageRendering: zoom > 1 ? "pixelated" as const : "auto" as const }
      : {};

  return createPortal(
    <div
      role="dialog"
      aria-label="memory image"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100001,
        background: "rgba(70, 70, 78, 0.28)",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={viewport}
        onClick={(event) => {
          event.stopPropagation();
          if (!zoomed && event.target === event.currentTarget) onClose();
        }}
        onPointerDown={(event) => {
          const v = viewport.current;
          if (!zoomed || !v || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, left: v.scrollLeft, top: v.scrollTop };
        }}
        onPointerMove={(event) => {
          const v = viewport.current, d = drag.current;
          if (!v || !d) return;
          v.scrollLeft = d.left - (event.clientX - d.x);
          v.scrollTop = d.top - (event.clientY - d.y);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        style={{
          position: "fixed",
          top: TOP_SPACE,
          bottom: PANEL_SPACE,
          left: 0,
          right: 0,
          display: "flex",
          overflow: zoomed ? "auto" : "hidden",
          cursor: zoomed ? "grab" : "default",
          touchAction: zoomed ? "none" : "auto",
        }}
      >
        <canvas
          ref={view}
          style={{
            margin: "auto",
            display: card ? "block" : "none",
            flex: "none",
            boxShadow: "0 18px 50px rgba(70, 70, 84, 0.18)",
            opacity: capturing ? 0.45 : 1,
            ...canvasStyle,
          }}
        />
        {(capturing || error) && (
          <p style={{ ...note, position: card ? "absolute" : "static", margin: "auto" }}>{error ?? "preparing the image…"}</p>
        )}
      </div>
      <div onClick={(event) => event.stopPropagation()} style={bar}>
        <button type="button" onClick={() => { void download(); }} disabled={!card} style={{ ...quiet, opacity: card ? 1 : 0.4 }}>download png</button>
        <button type="button" onClick={again} disabled={capturing} style={{ ...quiet, opacity: capturing ? 0.4 : 1 }}>again</button>
        <button type="button" onClick={onClose} style={quiet}>close</button>
      </div>
      <div onClick={(event) => event.stopPropagation()} style={panel}>
        <Row label="Tonal Contrast">
          <input
            aria-label="Tonal Contrast"
            type="range"
            min={TONAL_CONTRAST.min * 100}
            max={TONAL_CONTRAST.max * 100}
            step={1}
            value={percent}
            disabled={!frame}
            onChange={(event) => changeContrast(Number(event.target.value))}
            onDoubleClick={() => changeContrast(TONAL_CONTRAST.standard * 100)}
            style={slider}
          />
          <span style={value}>{percent}</span>
        </Row>
        <Row label="Wall Density">
          <WallSlider name="Density" field="density" surface={surface} disabled={!frame} onChange={setSurface} />
          <WallSlider name="Size" field="densitySize" surface={surface} disabled={!frame} onChange={setSurface} />
        </Row>
        <Row label="Wall Tooth">
          <WallSlider name="Tooth" field="tooth" surface={surface} disabled={!frame} onChange={setSurface} />
          <WallSlider name="Size" field="toothSize" surface={surface} disabled={!frame} onChange={setSurface} />
          <WallSlider name="Fine grain" field="grain" surface={surface} disabled={!frame} onChange={setSurface} />
        </Row>
        <Row label="Film Grain">
          <Segmented
            label="Film Grain"
            options={GRAIN_KINDS.map((k, i) => ({ value: k.kind, label: k.label, title: `${k.label} (${i})` }))}
            value={grain.kind}
            onChange={(kind: GrainKind) => setGrain((g) => ({ ...g, kind }))}
          />
        </Row>
        <Row label="Intensity">
          <input
            aria-label="Grain Intensity"
            type="range"
            min={GRAIN_INTENSITY.min * 100}
            max={GRAIN_INTENSITY.max * 100}
            step={1}
            value={Math.round(grain.intensity * 100)}
            onChange={(event) => setGrain((g) => ({ ...g, intensity: Number(event.target.value) / 100 }))}
            style={{ ...slider, width: 120 }}
          />
          <span style={value}>{Math.round(grain.intensity * 100)}</span>
          <span style={{ ...label, marginLeft: 14 }}>Size</span>
          <input
            aria-label="Grain Size"
            type="range"
            min={GRAIN_SIZE.min}
            max={GRAIN_SIZE.max}
            step={0.05}
            value={grain.size}
            onChange={(event) => setGrain((g) => ({ ...g, size: Number(event.target.value) }))}
            style={{ ...slider, width: 120 }}
          />
          <span style={value}>{grain.size.toFixed(2)}</span>
        </Row>
        <Row label="Zoom">
          <Segmented label="Zoom" options={ZOOMS} value={zoom} onChange={changeZoom} />
          <button
            type="button"
            aria-pressed={showOriginal}
            title="show the image without grain (hold O)"
            onClick={() => setOriginal((o) => !o)}
            style={{ ...segment(showOriginal), marginLeft: "auto" }}
          >
            original
          </button>
        </Row>
      </div>
      {capturing && (
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: 960, height: 960, pointerEvents: "none" }}>
          <VesselArtifact
            cacheKey={`preview-${session.draftId}|${attempt}`}
            form={vessel.form}
            morph={vessel.tune.morph}
            photoUrl={vessel.url || undefined}
            seed={vessel.seed}
            tune={vessel.tune}
            room={vessel.room}
            glassMode={vessel.mode}
            sheetMode={vessel.sheetMode}
            face={vessel.face}
            sheetSize={vessel.tune.sheetSize}
            still
            focused={false}
            frameloop="always"
            onReady={(canvas) => capture(canvas, attempt)}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}

function Row({ label: name, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 26 }}>
      <span style={{ ...label, width: 92, flex: "none" }}>{name}</span>
      {children}
    </div>
  );
}

/** One of the wall's settings, in percent of the built-in (100); a double-click returns it there. */
function WallSlider({ name, field, surface, disabled, onChange }: {
  name: string;
  field: keyof SurfaceSettings;
  surface: SurfaceSettings;
  disabled: boolean;
  onChange: (update: (s: SurfaceSettings) => SurfaceSettings) => void;
}) {
  const range = SURFACE_RANGE[field];
  const at = Math.round(surface[field] * 100);
  const set = (v: number) => onChange((s) => ({ ...s, [field]: v }));
  return (
    <>
      <span style={{ ...label, marginLeft: name === "Density" || name === "Tooth" ? 0 : 10 }}>{name}</span>
      <input
        aria-label={`Wall ${field.startsWith("density") ? "Density" : "Tooth"} ${name}`.replace(/(\w+) \1$/, "$1")}
        type="range"
        min={range.min * 100}
        max={range.max * 100}
        step={5}
        value={at}
        disabled={disabled}
        title="double-click for 100"
        onChange={(event) => set(Number(event.target.value) / 100)}
        onDoubleClick={() => set(SURFACE_DEFAULT[field])}
        style={{ ...slider, width: 96 }}
      />
      <span style={value}>{at}</span>
    </>
  );
}

function Segmented<T extends string | number>({ label: name, options, value: current, onChange }: {
  label: string;
  options: readonly { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", gap: 2 }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === current}
          title={o.title}
          onClick={() => onChange(o.value)}
          style={segment(o.value === current)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const segment = (on: boolean) => ({
  margin: 0,
  padding: "4px 9px",
  border: "none",
  borderRadius: 7,
  background: on ? "rgba(70, 70, 78, 0.1)" : "transparent",
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 12,
  fontWeight: on ? 500 : 400,
  whiteSpace: "nowrap" as const,
  cursor: "pointer",
});

const note = {
  position: "absolute" as const,
  margin: 0,
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 13,
};

const bar = {
  position: "fixed" as const,
  top: 22,
  right: 24,
  display: "flex",
  gap: 18,
  zIndex: 1,
};

const panel = {
  position: "fixed" as const,
  left: "50%",
  bottom: 18,
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  padding: "10px 16px",
  borderRadius: 12,
  background: "rgba(234, 234, 234, 0.82)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  zIndex: 1,
};

const label = {
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 12,
  whiteSpace: "nowrap" as const,
};

const value = { ...label, width: 30, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

const slider = { width: 220, margin: 0, accentColor: CHROME_GRAY };

const quiet = {
  margin: 0,
  padding: 0,
  border: "none",
  background: "transparent",
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 13,
  cursor: "pointer",
};
