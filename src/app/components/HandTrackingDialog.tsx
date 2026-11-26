import { PANE_CONTENT_GAP } from "../lib/theme";
import { GlassPane } from "./GlassPane";
import { CameraIcon, ClockIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions } from "./PaneOption";

export function HandTrackingDialog({ open, busy, error, onAllow, onManual, entrance }: {
  open: boolean;
  /** How the pane comes in (GlassPane); "spring" scales up to its size with a little overshoot. */
  entrance?: "rise" | "spring";
  busy: boolean;
  error: string | null;
  onAllow: () => void;
  onManual: () => void;
}) {
  return <GlassPane open={open} onClose={onManual} closeDisabled={busy} labelledBy="hand-tracking-title" align="start" entrance={entrance}>
    <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
      <h2 id="hand-tracking-title" style={PANE_TITLE}>
        Enable camera access
      </h2>
      <div className="nijimuPaneBody" style={PANE_BODY}>
        <p>We use camera to access hand-tracking, which allows you to sculpt this memory by hand. Please allow camera access from your browser.</p>
      </div>
      {error && <p role="alert" style={PANE_BODY}>
        We couldn’t start hand tracking. Allow camera access in your browser’s site settings and try again, or continue with the mouse.
      </p>}
    </div>
    <PaneOptions>
      <PaneOption primary mark={<CameraIcon />} disabled={busy} onClick={onAllow}
        label={busy ? "Starting hand tracking…" : error ? "Try camera again" : "Allow camera & Begin"} />
      <PaneOption mark={<ClockIcon />} ring label="Maybe later" disabled={busy} onClick={onManual} />
    </PaneOptions>
  </GlassPane>;
}
