import { PANE_CONTENT_GAP } from "../lib/theme";
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
      <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
        <h2 id="recording-instructions-title" style={PANE_TITLE}>To hear your voice</h2>
        <div id="recording-instructions-body" className="nijimuPaneBody" style={PANE_BODY}>
          <p>If you’d like to speak a memory, please allow microphone access in your browser.</p>
          <p>Or, skip to a sample story to experience the full flow without recording yourself.</p>
        </div>
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
