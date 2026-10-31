import { useState } from "react";
import { SANS } from "../lib/theme";
import {
  WASH_KNOBS,
  WASH_TUNE_DEFAULT,
  forgetWashTune,
  loadSavedWashTune,
  saveWashTune,
  type WashTune,
} from "../lib/washTune";

const INK = "#2A2018";
const MUTED = "rgba(42,32,24,.55)";

const decimals = (step: number) => (step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step))));

/** Sliders for the landing field, with one set that can be kept on this machine. */
export function WashTunePanel({ tune, onChange }: { tune: WashTune; onChange: (t: WashTune) => void }) {
  const [open, setOpen] = useState(false);
  const [hasSaved, setHasSaved] = useState(() => !!loadSavedWashTune());
  const [note, setNote] = useState("");
  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((n) => (n === text ? "" : n)), 1800);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const button: React.CSSProperties = {
    font: `400 11px ${SANS}`,
    color: INK,
    background: "transparent",
    border: `1px solid rgba(42,32,24,.22)`,
    borderRadius: 999,
    padding: "5px 10px",
    cursor: "pointer",
  };

  return (
    <div
      data-tune-panel
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
      onWheel={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 80, fontFamily: SANS, color: INK }}
    >
      {open && (
        <div
          style={{
            width: 268,
            maxHeight: "calc(100dvh - 72px)",
            overflowY: "auto",
            marginBottom: 8,
            padding: "14px 16px 12px",
            background: "rgba(240,240,238,.82)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            borderRadius: 10,
            boxShadow: "0 6px 28px rgba(0,0,0,.08)",
          }}
        >
          {WASH_KNOBS.map(({ group, knobs }) => (
            <div key={group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>
                {group}
              </div>
              {knobs.map((k) => (
                <label key={k.key} style={{ display: "block", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span>{k.label}</span>
                    <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                      {tune[k.key].toFixed(decimals(k.step))}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={k.min}
                    max={k.max}
                    step={k.step}
                    value={tune[k.key]}
                    onChange={(e) => onChange({ ...tune, [k.key]: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#504A4A" }}
                  />
                </label>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              style={{ ...button, fontWeight: 500 }}
              onClick={() => { saveWashTune(tune); setHasSaved(true); flash("saved on this machine"); }}
            >
              save
            </button>
            {hasSaved && (
              <button
                type="button"
                style={button}
                onClick={() => { onChange({ ...WASH_TUNE_DEFAULT, ...(loadSavedWashTune() ?? {}) }); flash("back to the saved set"); }}
              >
                revert to saved
              </button>
            )}
            <button type="button" style={button} onClick={() => { onChange(WASH_TUNE_DEFAULT); flash("built-in values"); }}>
              built-in
            </button>
            {hasSaved && (
              <button
                type="button"
                style={button}
                onClick={() => { forgetWashTune(); setHasSaved(false); flash("saved set forgotten"); }}
              >
                forget saved
              </button>
            )}
            <button
              type="button"
              style={button}
              onClick={() => {
                void navigator.clipboard?.writeText(JSON.stringify(tune, null, 2));
                flash("copied");
              }}
            >
              copy values
            </button>
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 8, minHeight: 14 }}>
            {note || (hasSaved ? "opens with your saved set" : "built-in values")}
          </div>
        </div>
      )}
      <button type="button" style={{ ...button, background: "rgba(240,240,238,.7)" }} onClick={() => setOpen((o) => !o)}>
        {open ? "close" : "tune"}
      </button>
    </div>
  );
}
