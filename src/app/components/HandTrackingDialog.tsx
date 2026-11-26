import { PANE_CONTENT_GAP } from "../lib/theme";
import { GlassPane } from "./GlassPane";
import { CameraIcon, ClockIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions } from "./PaneOption";
import { useT } from "../lib/i18n";

export function HandTrackingDialog({ open, busy, error, onAllow, onManual, entrance }: {
  open: boolean;
  /** How the pane comes in (GlassPane); "spring" scales up to its size with a little overshoot. */
  entrance?: "rise" | "spring";
  busy: boolean;
  error: string | null;
  onAllow: () => void;
  onManual: () => void;
}) {
  const ui = useT();
  return <GlassPane open={open} onClose={onManual} closeDisabled={busy} labelledBy="hand-tracking-title" align="start" entrance={entrance}>
    <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
      <h2 id="hand-tracking-title" style={PANE_TITLE}>
        {ui.cameraTitle}
      </h2>
      <div className="nijimuPaneBody" style={PANE_BODY}>
        <p>{ui.cameraBody}</p>
      </div>
      {error && <p role="alert" style={PANE_BODY}>
        {ui.cameraError}
      </p>}
    </div>
    <PaneOptions>
      <PaneOption primary mark={<CameraIcon />} disabled={busy} onClick={onAllow}
        label={busy ? ui.startingTracking : error ? ui.tryCameraAgain : ui.allowCamera} />
      <PaneOption mark={<ClockIcon />} ring label={ui.maybeLater} disabled={busy} onClick={onManual} />
    </PaneOptions>
  </GlassPane>;
}
