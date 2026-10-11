import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CHROME_GRAY, PANE_INK } from "../lib/colors";
import { BODY_SIZE, SERIF } from "../lib/theme";

export type SpectrumEnd = "circle" | "flower" | "petals" | "bloom" | "haze";

const KNOB_REST = { w: 6, h: 16, r: 3 };
const KNOB_HELD = { w: 7, h: 15.3, r: 0.75 };
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const GLYPH = "#AEB0B0";
const BLOOM_DARK = "#767878";
const BLOOM_OVERLAP = "#808282";

/** Petals are ellipses about the centre, in units of the 286×312 source drawings (scaled 1/12 on screen). */
const PETAL_A = 74.8;
const PETAL_B = 53;
const PETAL_D = 81.2;
/** The open centre of the rhythm glyphs. */
const CORE = 39.5;

/** One subpath per petal, so `evenodd` cuts away wherever two petals overlap. */
function petalRing(count: number, startDeg: number) {
  return Array.from({ length: count }, (_, i) => {
    const deg = startDeg + (i * 360) / count;
    const t = (deg * Math.PI) / 180;
    const cx = Math.cos(t) * PETAL_D;
    const cy = Math.sin(t) * PETAL_D;
    const dx = Math.cos(t) * PETAL_A;
    const dy = Math.sin(t) * PETAL_A;
    const p = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    return `M${p(cx + dx, cy + dy)} A${PETAL_A} ${PETAL_B} ${deg} 1 0 ${p(cx - dx, cy - dy)} A${PETAL_A} ${PETAL_B} ${deg} 1 0 ${p(cx + dx, cy + dy)} Z`;
  }).join(" ");
}
const SIX = petalRing(6, -90);
const SIX_TURNED = petalRing(6, -60);

export function SpectrumGlyph({ end }: { end: SpectrumEnd }) {
  if (end === "circle") {
    return <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden><circle cx={11} cy={11} r={11} fill={GLYPH} /></svg>;
  }
  if (end === "flower") {
    return (
      <svg width={24} height={26} viewBox="-143 -156 286 312" aria-hidden>
        <path d={SIX} fill={GLYPH} />
        <circle r={24} fill={GLYPH} />
      </svg>
    );
  }
  if (end === "petals") {
    return (
      <svg width={24} height={26} viewBox="-143 -156 286 312" aria-hidden>
        <defs>
          <mask id="spectrum-petals-core" maskUnits="userSpaceOnUse" x={-160} y={-160} width={320} height={320}>
            <rect x={-160} y={-160} width={320} height={320} fill="#fff" />
            <circle r={CORE} fill="#000" />
          </mask>
        </defs>
        <path d={SIX} fill={GLYPH} fillRule="evenodd" mask="url(#spectrum-petals-core)" />
      </svg>
    );
  }
  if (end === "bloom") {
    return (
      <svg width={26.3} height={26} viewBox="-158 -156 316 312" aria-hidden>
        <defs>
          <clipPath id="spectrum-bloom-turned"><path d={SIX_TURNED} clipRule="evenodd" /></clipPath>
          <mask id="spectrum-bloom-core" maskUnits="userSpaceOnUse" x={-160} y={-160} width={320} height={320}>
            <rect x={-160} y={-160} width={320} height={320} fill="#fff" />
            <circle r={CORE} fill="#000" />
          </mask>
        </defs>
        <g mask="url(#spectrum-bloom-core)">
          <path d={SIX} fill={GLYPH} fillRule="evenodd" />
          <path d={SIX_TURNED} fill={BLOOM_DARK} fillRule="evenodd" />
          <path d={SIX} fill={BLOOM_OVERLAP} fillRule="evenodd" clipPath="url(#spectrum-bloom-turned)" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={47} height={47} viewBox="0 0 47 47" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <filter id="spectrum-haze" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={4.2} />
        </filter>
      </defs>
      <circle cx={23.5} cy={23.5} r={11.5} fill={GLYPH} filter="url(#spectrum-haze)" />
    </svg>
  );
}

type Props = {
  /** 0…1 */
  value: number;
  onChange: (value: number) => void;
  from: SpectrumEnd;
  to: SpectrumEnd;
  label: string;
  valueText?: string;
  /** Arrow-key step, as a fraction of the range. */
  keyStep?: number;
  style?: CSSProperties;
};

/** The handling steps' slider: a hairline between two glyphs of the spectrum's ends. */
export function SpectrumSlider({ value, onChange, from, to, label, valueText, keyStep = 0.05, style }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const v = Math.max(0, Math.min(1, value));

  const valueAt = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return v;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no pointer to capture */ }
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    setDragging(true);
    onChange(valueAt(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (dragging) onChange(valueAt(e.clientX)); };
  const up = () => setDragging(false);
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === "Home" ? 0 : e.key === "End" ? 1
      : e.key === "ArrowRight" || e.key === "ArrowUp" ? v + keyStep
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? v - keyStep
      : e.key === "PageUp" ? v + keyStep * 4 : e.key === "PageDown" ? v - keyStep * 4 : null;
    if (next === null) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(1, next)));
  };

  const tick: CSSProperties = { position: "absolute", top: "50%", width: 1, height: 11, marginTop: -5.5, background: CHROME_GRAY, opacity: 0.8 };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 32, width: "min(56ch, calc(100vw - 48px))",
      fontFamily: SERIF, fontSize: BODY_SIZE, ...style }}>
      <style>{`
        .spectrum-slider { outline: none; }
        .spectrum-knob {
          width: ${KNOB_REST.w}px; height: ${KNOB_REST.h}px; border-radius: ${KNOB_REST.r}px;
          background: ${PANE_INK.secondary};
          transition: width 280ms ${EASE}, height 280ms ${EASE}, border-radius 280ms ${EASE}, background-color 280ms ${EASE};
        }
        .spectrum-slider[data-dragging] .spectrum-knob,
        .spectrum-slider:focus-visible .spectrum-knob {
          width: ${KNOB_HELD.w}px; height: ${KNOB_HELD.h}px; border-radius: ${KNOB_HELD.r}px; background: ${PANE_INK.body};
        }
        @media (hover: hover) {
          .spectrum-grip:hover .spectrum-knob {
            width: ${KNOB_HELD.w}px; height: ${KNOB_HELD.h}px; border-radius: ${KNOB_HELD.r}px; background: ${PANE_INK.body};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .spectrum-knob { transition-duration: 120ms; }
        }
      `}</style>
      <span style={{ flex: "0 0 26px", height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}><SpectrumGlyph end={from} /></span>
      <div className="spectrum-slider" role="slider" tabIndex={0} aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-valuetext={valueText}
        data-dragging={dragging || undefined}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
        onKeyDown={key}
        style={{ position: "relative", flex: 1, height: 32, touchAction: "none", cursor: dragging ? "grabbing" : "pointer" }}>
        <div ref={track} style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, marginTop: -0.5, background: CHROME_GRAY, opacity: 0.8 }} />
        <span style={{ ...tick, left: 0 }} />
        <span style={{ ...tick, right: 0 }} />
        <span className="spectrum-grip" style={{ position: "absolute", top: 0, bottom: 0, width: 24, left: `calc(${v * 100}% - 12px)`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: dragging ? "grabbing" : "grab" }}>
          <span className="spectrum-knob" />
        </span>
      </div>
      <span style={{ flex: "0 0 26px", height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}><SpectrumGlyph end={to} /></span>
    </div>
  );
}
