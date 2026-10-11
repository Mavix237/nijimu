import { GlassPane } from "./GlassPane";
import { CameraIcon, HandIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions } from "./PaneOption";
import { PANE_INK } from "../lib/colors";

export function HandTrackingDialog({ open, busy, error, onAllow, onManual }: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onAllow: () => void;
  onManual: () => void;
}) {
  return <GlassPane open={open} onClose={onManual} closeDisabled={busy} labelledBy="hand-tracking-title" align="start">
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 id="hand-tracking-title" style={PANE_TITLE}>
        Sculpt this memory by{" "}
        <span style={{ whiteSpace: "nowrap" }}>
          hand
          <span aria-hidden style={{ display: "inline-block", verticalAlign: "-0.14em", marginLeft: "0.42em", color: PANE_INK.title, opacity: 0.7 }}>
            <HandIcon size="1.05em" />
          </span>
        </span>
      </h2>
      <p style={PANE_BODY}>
        <span style={{ display: "block" }}>Hand-tracking is essential to shaping your memory.</span>
        <span style={{ display: "block" }}>Please allow camera access from your browser.</span>
      </p>
      {error && <p role="alert" style={PANE_BODY}>
        We couldn’t start hand tracking. Allow camera access in your browser’s site settings and try again, or continue with the mouse.
      </p>}
    </div>
    <PaneOptions>
      <PaneOption primary mark={<CameraIcon />} disabled={busy} onClick={onAllow}
        label={busy ? "Starting hand tracking…" : error ? "Try camera again" : "Allow camera & Begin"} />
      <PaneOption label="Maybe later" disabled={busy} onClick={onManual} />
    </PaneOptions>
  </GlassPane>;
}
