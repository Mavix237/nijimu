import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { invalidate } from "@react-three/fiber";
import { CHROME_GRAY } from "../lib/colors";
import {
  type ExportFormat,
  type ExportPreset,
  type GradeSettings,
  type LutId,
  clamp,
  getGrade,
  patchGrade,
  resetGrade,
  setGradeMenu,
  subscribeGrade,
} from "../lib/cameraGrade";
import { pageIsMotion, primaryFocalMm, primaryFocus } from "../lib/gradeRuntime";
import { exportScene } from "../lib/renderExport";
import { SANS } from "../lib/theme";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "./HeaderIconLabel";
import { HEADER_MENU_ORDER, useHeaderMenu, useRenderSeat } from "./HeaderMenu";

const PRESETS: { id: ExportPreset; label: string }[] = [
  { id: "1080p", label: "1080p" },
  { id: "2k", label: "2k" },
  { id: "4k", label: "4k" },
  { id: "8k", label: "8k" },
  { id: "custom", label: "custom" },
];

const LUTS: { id: LutId; label: string }[] = [
  { id: "off", label: "off" },
  { id: "print", label: "print" },
  { id: "portrait", label: "portrait" },
];

const F_MIN = 1.4;
const F_MAX = 16;
const FOCUS_MIN = 0.2;
const FOCUS_MAX = 200;

function useSyncGrade(): GradeSettings {
  const [grade, setGrade] = useState(getGrade);
  useEffect(() => subscribeGrade(() => setGrade(getGrade())), []);
  return grade;
}

function fToT(f: number): number {
  return Math.log(clamp(f, F_MIN, F_MAX) / F_MIN) / Math.log(F_MAX / F_MIN);
}

function tToF(t: number): number {
  return F_MIN * Math.pow(F_MAX / F_MIN, clamp(t, 0, 1));
}

function logToT(v: number, min: number, max: number): number {
  return Math.log(clamp(v, min, max) / min) / Math.log(max / min);
}

function tToLog(t: number, min: number, max: number): number {
  return min * Math.pow(max / min, clamp(t, 0, 1));
}

function round(v: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

/**
 * The corner render menu. A still view can preview the camera and print
 * settings. A moving full-frame view, such as the pond, is left as it is:
 * the export only raises the pixel size. Closing the menu puts a still
 * view back. Export restores the live size either way.
 */
export function RenderMenu({ hidden = false }: { hidden?: boolean }) {
  const { list, close } = useHeaderMenu();
  const seat = useRenderSeat();
  const grade = useSyncGrade();
  const [open, setOpen] = useState(false);
  const [nameShown, setNameShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sections, setSections] = useState({ camera: true, color: true, film: true, export: true });

  useEffect(() => {
    setGradeMenu(open);
    if (open) invalidate();
    return () => {
      if (!open) return;
      setGradeMenu(false);
      invalidate();
    };
  }, [open]);

  useEffect(() => () => {
    setGradeMenu(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target instanceof Element && target.closest("[data-render-menu]")) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const set = <K extends keyof GradeSettings>(key: K, value: GradeSettings[K]) => {
    patchGrade({ [key]: value });
    invalidate();
  };

  const motion = open && pageIsMotion();
  const sceneMm = round(primaryFocalMm(), 1);
  const focal = grade.focalMm ?? sceneMm;
  const liveFocus = grade.focusAuto ? round(primaryFocus() ?? grade.focus, 2) : grade.focus;

  const save = () => {
    if (busy) return;
    setBusy(true);
    setNote("rendering…");
    void exportScene({
      preset: grade.preset,
      customW: grade.customW,
      customH: grade.customH,
      format: grade.format,
      jpgQuality: grade.jpgQuality,
      onProgress: setNote,
    }).then((result) => {
      const size = `${result.width}×${result.height}`;
      setNote(result.limitedTo ? `saved · ${size} · limited to ${result.limitedTo}px` : `saved · ${size}`);
    }).catch((error: unknown) => {
      setNote(error instanceof Error ? error.message : "couldn't render");
    }).finally(() => setBusy(false));
  };

  const glyph = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.25 5.25V2.75H4.75" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.25 2.75H13.75V5.25" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.75 10.75V13.25H11.25" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.75 13.25H2.25V10.75" stroke={CHROME_GRAY} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const toggle = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setNote(null);
    setOpen((value) => {
      if (!value) close();
      return !value;
    });
  };

  const panel = open ? createPortal(
    <div
      data-render-menu
      role="dialog"
      aria-label="render"
      style={panelStyle(seat)}
    >
      {!motion && <>
      <Section title="camera & lens" open={sections.camera} onToggle={() => setSections((s) => ({ ...s, camera: !s.camera }))}>
        <SliderRow label="focal length" min={14} max={200} step={1} value={round(focal, 1)} digits={1}
          disabled={busy} suffix="mm" onChange={(value) => set("focalMm", value)} />
        <Check label="keep subject size" checked={grade.holdSubject} disabled={busy} onChange={(value) => set("holdSubject", value)} />
        <SliderRow label="aperture" min={0} max={1} step={0.001} value={fToT(grade.fStop)} digits={1}
          numMin={F_MIN} numMax={F_MAX}
          display={round(tToF(fToT(grade.fStop)), 1)} prefix="f/"
          disabled={busy} onChange={(t) => set("fStop", round(tToF(t), 2))}
          onDisplay={(value) => set("fStop", round(clamp(value, F_MIN, F_MAX), 2))} />
        <SliderRow label="focus distance" min={0} max={1} step={0.001} value={logToT(liveFocus, FOCUS_MIN, FOCUS_MAX)} digits={2}
          numMin={FOCUS_MIN} numMax={FOCUS_MAX}
          display={round(liveFocus, 2)} disabled={busy}
          onChange={(t) => { patchGrade({ focusAuto: false, focus: round(tToLog(t, FOCUS_MIN, FOCUS_MAX), 2) }); invalidate(); }}
          onDisplay={(value) => { patchGrade({ focusAuto: false, focus: round(clamp(value, FOCUS_MIN, FOCUS_MAX), 2) }); invalidate(); }} />
        <Check label="focus on subject" checked={grade.focusAuto} disabled={busy} onChange={(value) => set("focusAuto", value)} />
        <SliderRow label="lens softness" min={0} max={1} step={0.01} value={grade.softness} digits={2} disabled={busy} onChange={(value) => set("softness", value)} />
        <SliderRow label="chromatic aberration" min={0} max={1} step={0.01} value={grade.aberration} digits={2} disabled={busy} onChange={(value) => set("aberration", value)} />
      </Section>
      <Section title="color & tone" open={sections.color} onToggle={() => setSections((s) => ({ ...s, color: !s.color }))}>
        <SliderRow label="exposure" min={-2} max={2} step={0.01} value={grade.exposure} digits={2} disabled={busy} onChange={(value) => set("exposure", value)} />
        <SliderRow label="contrast" min={-0.4} max={0.4} step={0.01} value={grade.contrast} digits={2} disabled={busy} onChange={(value) => set("contrast", value)} />
        <SliderRow label="highlight roll-off" min={0} max={1} step={0.01} value={grade.rolloff} digits={2} disabled={busy} onChange={(value) => set("rolloff", value)} />
        <SliderRow label="color temperature" min={2700} max={9000} step={50} value={grade.temperature} digits={0} suffix="k" disabled={busy} onChange={(value) => set("temperature", value)} />
        <SliderRow label="saturation" min={-0.8} max={0.8} step={0.01} value={grade.saturation} digits={2} disabled={busy} onChange={(value) => set("saturation", value)} />
        <div style={choiceRow}>
          <span style={rowLabel}>color response</span>
          <span style={choices}>
            {LUTS.map((lut) => (
              <Choice key={lut.id} pressed={grade.lut === lut.id} disabled={busy} onClick={() => set("lut", lut.id)}>{lut.label}</Choice>
            ))}
          </span>
        </div>
      </Section>
      <Section title="film & print" open={sections.film} onToggle={() => setSections((s) => ({ ...s, film: !s.film }))}>
        <SliderRow label="grain" min={0} max={1} step={0.01} value={grade.grain} digits={2} disabled={busy} onChange={(value) => set("grain", value)} />
        <SliderRow label="grain size" min={0.4} max={3} step={0.01} value={grade.grainSize} digits={2} disabled={busy} onChange={(value) => set("grainSize", value)} />
        <SliderRow label="grain tones" min={0} max={1} step={0.01} value={grade.grainTone} digits={2} disabled={busy} onChange={(value) => set("grainTone", value)} />
        <SliderRow label="grain contrast" min={0} max={1} step={0.01} value={grade.grainContrast} digits={2} disabled={busy} onChange={(value) => set("grainContrast", value)} />
        <SliderRow label="halation" min={0} max={1} step={0.01} value={grade.halation} digits={2} disabled={busy} onChange={(value) => set("halation", value)} />
        <SliderRow label="paper" min={0} max={1} step={0.01} value={grade.paper} digits={2} disabled={busy} onChange={(value) => set("paper", value)} />
      </Section>
      </>}
      <Section title="export" open={sections.export} onToggle={() => setSections((s) => ({ ...s, export: !s.export }))}>
        <div style={choiceRow}>
          <span style={rowLabel}>resolution</span>
          <span style={choices}>
            {PRESETS.map((preset) => (
              <Choice key={preset.id} pressed={grade.preset === preset.id} disabled={busy} onClick={() => set("preset", preset.id)}>{preset.label}</Choice>
            ))}
          </span>
        </div>
        {grade.preset === "custom" && (
          <div style={choiceRow}>
            <span style={rowLabel}>size</span>
            <span style={choices}>
              <Num value={grade.customW} min={320} max={8192} digits={0} disabled={busy} onChange={(value) => set("customW", Math.round(value))} />
              <span style={times}>×</span>
              <Num value={grade.customH} min={320} max={8192} digits={0} disabled={busy} onChange={(value) => set("customH", Math.round(value))} />
            </span>
          </div>
        )}
        <div style={choiceRow}>
          <span style={rowLabel}>format</span>
          <span style={choices}>
            {(["png", "jpg"] as ExportFormat[]).map((format) => (
              <Choice key={format} pressed={grade.format === format} disabled={busy} onClick={() => set("format", format)}>{format}</Choice>
            ))}
          </span>
        </div>
        {grade.format === "jpg" && (
          <SliderRow label="jpg quality" min={0.6} max={1} step={0.01} value={grade.jpgQuality} digits={2} disabled={busy} onChange={(value) => set("jpgQuality", value)} />
        )}
        <button type="button" disabled={busy} onClick={save} style={exportButton}>
          {busy ? "rendering…" : "export image"}
        </button>
        {note && <span style={noteStyle}>{note}</span>}
      </Section>
      {!motion && (
        <button
          type="button"
          disabled={busy}
          onClick={() => { resetGrade(); invalidate(); setNote(null); }}
          style={resetButton}
        >
          reset
        </button>
      )}
    </div>,
    document.body,
  ) : null;

  if (list) {
    return (
      <>
        {createPortal(
          <div data-render-menu style={{ display: "contents" }}>
            <button
              type="button"
              role="menuitem"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={toggle}
              style={rowStyle(HEADER_MENU_ORDER.render)}
            >
              <span aria-hidden style={iconBox}>{glyph}</span>
              render
            </button>
          </div>,
          list,
        )}
        {panel}
      </>
    );
  }

  return (
    <div data-render-menu style={{ display: "contents" }}>
      <button
        type="button"
        aria-label="render"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="nijimu-press-icon"
        onClick={toggle}
        onMouseEnter={() => setNameShown(true)}
        onMouseLeave={() => setNameShown(false)}
        onFocus={() => setNameShown(true)}
        onBlur={() => setNameShown(false)}
        style={{
          position: "fixed",
          top: "var(--chrome-top)",
          right: `var(--chrome-${seat})`,
          zIndex: 99999,
          boxSizing: "border-box",
          width: "var(--chrome-icon)",
          height: 36 + HEADER_ICON_LABEL_PAD,
          padding: `0 0 ${HEADER_ICON_LABEL_PAD}px`,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: hidden ? 0 : 0.85,
          pointerEvents: hidden ? "none" : "auto",
          transition: "opacity 300ms ease",
        }}
      >
        <HeaderIconLabel name="render" shown={nameShown && !open} />
        {glyph}
      </button>
      {panel}
    </div>
  );
}

function Section({ title, open, onToggle, children }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <button type="button" aria-expanded={open} onClick={onToggle} style={sectionButton}>
        <span>{title}</span>
        <span aria-hidden style={{ opacity: 0.55 }}>{open ? "–" : "+"}</span>
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "2px 2px 10px" }}>{children}</div>}
    </section>
  );
}

function SliderRow({ label, min, max, step, value, display, digits, numMin, numMax, prefix, suffix, disabled, onChange, onDisplay }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display?: number;
  digits: number;
  numMin?: number;
  numMax?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onDisplay?: (value: number) => void;
}) {
  const shown = display ?? value;
  return (
    <label style={sliderRow}>
      <span style={sliderLabel}>
        <span style={rowLabel}>{label}</span>
        {prefix && <span style={unit}>{prefix}</span>}
        <Num value={shown} min={numMin ?? min} max={numMax ?? max} digits={digits} disabled={disabled}
          onChange={(next) => (onDisplay ?? onChange)(next)} />
        {suffix && <span style={unit}>{suffix}</span>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={range}
      />
    </label>
  );
}

function Num({ value, min, max, digits, disabled, onChange }: {
  value: number;
  min: number;
  max: number;
  digits: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={digits === 0 ? 1 : 10 ** -digits}
      disabled={disabled}
      value={Number.isFinite(value) ? round(value, digits) : 0}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      style={num}
    />
  );
}

function Check({ label, checked, disabled, onChange }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={checkRow}>
      <span style={rowLabel}>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Choice({ pressed, disabled, onClick, children }: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} onClick={onClick} style={{
      ...choice,
      fontWeight: pressed ? 500 : 400,
      opacity: pressed ? 1 : 0.55,
    }}>
      {children}
    </button>
  );
}

const ink = {
  color: CHROME_GRAY,
  fontFamily: SANS,
  fontSize: 11,
  letterSpacing: "0.04em",
  lineHeight: 1.2,
  textTransform: "lowercase" as const,
};

function panelStyle(seat: string): CSSProperties {
  return {
    position: "fixed",
    top: "calc(var(--chrome-top) + 40px)",
    right: `max(12px, var(--chrome-${seat}))`,
    zIndex: 100000,
    width: "min(292px, calc(100vw - 24px))",
    maxHeight: "min(78dvh, 720px)",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "6px 10px 8px",
    borderRadius: 12,
    backgroundColor: "rgba(234, 234, 234, 0.82)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "0 8px 28px rgba(70, 70, 84, 0.1)",
    colorScheme: "light",
  };
}

const sectionButton: CSSProperties = {
  ...ink,
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  margin: 0,
  padding: "8px 2px 6px",
  border: "none",
  borderTop: "1px solid rgba(126, 126, 134, 0.18)",
  background: "transparent",
  cursor: "pointer",
  fontSize: 10,
  letterSpacing: "0.08em",
};

const sliderRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  margin: 0,
};

const sliderLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const rowLabel: CSSProperties = {
  ...ink,
  flex: 1,
  textAlign: "left",
};

const range: CSSProperties = {
  width: "100%",
  margin: 0,
  accentColor: CHROME_GRAY,
  height: 14,
};

const num: CSSProperties = {
  ...ink,
  width: 52,
  margin: 0,
  padding: "1px 2px",
  border: "none",
  borderRadius: 4,
  background: "rgba(255, 255, 255, 0.45)",
  textAlign: "right",
};

const unit: CSSProperties = {
  ...ink,
  opacity: 0.6,
  fontSize: 10,
};

const checkRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  margin: 0,
};

const choiceRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const choices: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 2,
};

const choice: CSSProperties = {
  ...ink,
  margin: 0,
  padding: "3px 5px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

const times: CSSProperties = {
  ...ink,
  opacity: 0.45,
};

const exportButton: CSSProperties = {
  ...ink,
  margin: "4px 0 0",
  padding: "8px 2px",
  border: "none",
  borderTop: "1px solid rgba(126, 126, 134, 0.18)",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
};

const resetButton: CSSProperties = {
  ...ink,
  margin: 0,
  padding: "8px 2px 4px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  opacity: 0.7,
  textAlign: "left",
};

const noteStyle: CSSProperties = {
  ...ink,
  display: "block",
  opacity: 0.7,
  padding: "2px 2px 0",
};

const iconBox: CSSProperties = {
  width: 16,
  height: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function rowStyle(order: number): CSSProperties {
  return {
    ...ink,
    order,
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: 0,
    padding: "11px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    whiteSpace: "nowrap",
  };
}
