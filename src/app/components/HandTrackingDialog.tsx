import { GlassPane } from "./GlassPane";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";
import { BODY_SIZE, SERIF, TITLE } from "../lib/theme";
import { CHROME_GRAY } from "../lib/colors";

export function HandTrackingDialog({ open, busy, error, onAllow, onManual }: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onAllow: () => void;
  onManual: () => void;
}) {
  return <GlassPane open={open} onClose={onManual} closeDisabled={busy}
    closeLabel="continue without hand tracking" labelledBy="hand-tracking-title">
    <h2 id="hand-tracking-title" style={{ ...TITLE, color: CHROME_GRAY, margin: 0, textAlign: "center" }}>
      Sculpt this memory by hand
    </h2>
    <div style={{ fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.65, color: CHROME_GRAY }}>
      <p style={{ margin: 0 }}>Hand tracking is essential to creating your memory artifact. Please allow camera access when your browser asks.</p>
    </div>
    {error && <p role="alert" style={{ fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.5, color: CHROME_GRAY, margin: 0 }}>
      We couldn’t start hand tracking. Allow camera access in your browser’s site settings and try again, or continue with the mouse.
    </p>}
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
      <PillButton label={busy ? "Starting hand tracking…" : error ? "Try camera again" : "Allow camera & begin"}
        disabled={busy} onClick={onAllow} transform="none" style={{ width: "100%" }} />
      <TextButton label="Maybe later" disabled={busy} onClick={onManual} />
    </div>
  </GlassPane>;
}
