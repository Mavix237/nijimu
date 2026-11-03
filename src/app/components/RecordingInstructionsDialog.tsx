import { PANE_CONTENT_GAP, SANS } from "../lib/theme";
import { PANE_INK } from "../lib/colors";
import { DEMO_MEMORIES } from "../data/demoMemories";
import { useState } from "react";
import { GlassPane } from "./GlassPane";
import { ArrowIcon, MicIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions } from "./PaneOption";

/** Intentionally shown on every recording attempt, regardless of past visits
 * or whether the browser already remembers microphone permission.
 * The small numbers beside the sample begin with one of `DEMO_MEMORIES`. */
export function RecordingInstructionsDialog({ busy, error, onStart, onSkip, onMemory, onClose }: {
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onSkip: () => void;
  onMemory?: (index: number) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <GlassPane
      open={open}
      onClose={() => { if (!busy) setOpen(false); }}
      onExited={onClose}
      labelledBy="recording-instructions-title"
      closeDisabled={busy}
      align="start"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
        <h2 id="recording-instructions-title" style={PANE_TITLE}>To hear your voice</h2>
        <div id="recording-instructions-body" className="nijimuPaneBody" style={PANE_BODY}>
          <p>If you’d like to speak about a memory, please allow microphone access in your browser.</p>
          <p>Or, skip to a sample story to experience the full flow without recording yourself.</p>
        </div>
        {error && <p role="alert" style={PANE_BODY}>{error}</p>}
      </div>

      <PaneOptions>
        <PaneOption primary mark={<MicIcon />} label={busy ? "Opening microphone…" : "Allow microphone & record my story"}
          onClick={onStart} disabled={busy} />
        <div style={{ position: "relative" }}>
          <PaneOption mark={<ArrowIcon />} label="Skip to a sample story" onClick={() => onSkip()} disabled={busy} />
          {onMemory && (
            <span style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 2 }}>
              {DEMO_MEMORIES.map((memory, i) => (
                <button key={i} type="button" className="nijimuDemoPick" disabled={busy}
                  aria-label={`Begin with “${memory.title}”`} title={memory.title}
                  onClick={() => onMemory(i)}>{i + 1}</button>
              ))}
            </span>
          )}
        </div>
      </PaneOptions>
      <style>{`
        .nijimuDemoPick {
          border: 0; background: transparent; padding: 4px 5px; cursor: pointer;
          font-family: ${SANS}; font-size: 10px; line-height: 1; color: ${PANE_INK.body};
          opacity: .45; transition: opacity 160ms ease;
          font-variant-numeric: tabular-nums;
        }
        .nijimuDemoPick:disabled { cursor: default; opacity: .2; }
        @media (hover: hover) { .nijimuDemoPick:not(:disabled):hover { opacity: 1; } }
        .nijimuDemoPick:focus { outline: none; }
        .nijimuDemoPick:focus-visible { opacity: 1; box-shadow: 0 0 0 1px rgba(123, 123, 135, 0.35); }
      `}</style>
    </GlassPane>
  );
}
