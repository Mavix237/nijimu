import { useState } from "react";
import { GlassPane } from "./GlassPane";
import { ArrowIcon, MicIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions } from "./PaneOption";

/** Intentionally shown on every recording attempt, regardless of past visits
 * or whether the browser already remembers microphone permission. */
export function RecordingInstructionsDialog({ busy, error, onStart, onSkip, onClose }: {
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onSkip: () => void;
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="recording-instructions-title" style={PANE_TITLE}>To hear your voice</h2>
        <p id="recording-instructions-body" style={PANE_BODY}>
          <span style={{ display: "block" }}>If you’d like to speak a memory, please allow microphone access in your browser.</span>
          <span style={{ display: "block" }}>Or, skip to a sample story to experience the full flow without recording yourself.</span>
        </p>
        {error && <p role="alert" style={PANE_BODY}>{error}</p>}
      </div>

      <PaneOptions>
        <PaneOption primary mark={<MicIcon />} label={busy ? "Opening microphone…" : "Allow microphone & record my story"}
          onClick={onStart} disabled={busy} />
        <PaneOption mark={<ArrowIcon />} label="Skip to a sample story" onClick={onSkip} disabled={busy} />
      </PaneOptions>
    </GlassPane>
  );
}
