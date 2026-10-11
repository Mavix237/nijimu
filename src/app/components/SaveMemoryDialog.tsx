import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlassPane } from "./GlassPane";
import { PillButton } from "./PillButton";
import { TextButton } from "./TextButton";
import { BODY_SIZE, SERIF, TITLE } from "../lib/theme";
import { CHROME_GRAY } from "../lib/colors";
import type { NamingSession } from "./NamingRim";
import { draftArtifactOf } from "../lib/namingDraft";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { VesselArtifact } from "../lab/VesselArtifact";
import { copyArtifactFrame, downloadMemoryImage, memoryImage } from "../lib/memoryImage";

export function SaveMemoryDialog({ session, title, year, onClose, onContinue, storageError }: {
  session: NamingSession; title: string; year: string;
  onClose: () => void; onContinue: () => void;
  storageError?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);
  const captured = useRef(false);
  const vessel = useMemo(() => galleryStateFor(draftArtifactOf(session)), [session]);
  useEffect(() => () => { attempt.current++; }, []);
  useEffect(() => {
    // Escape belongs to this dialog, not the pond's underlying Back shortcut.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) onClose();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [busy, onClose]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => {
      attempt.current++;
      setBusy(false);
      setError("The image couldn’t be prepared. Please try again, or continue without downloading.");
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const exportFrame = async (canvas: HTMLCanvasElement) => {
    if (captured.current) return;
    captured.current = true;
    const current = attempt.current;
    try {
      const frame = copyArtifactFrame(canvas);
      const blob = await memoryImage(frame, title, year, session.state.transcript ?? "");
      if (attempt.current !== current) return;
      downloadMemoryImage(blob, title);
      setBusy(false);
      onContinue();
    } catch {
      if (attempt.current !== current) return;
      setBusy(false);
      setError("The image couldn’t be downloaded. Please try again, or continue without downloading.");
    }
  };

  return createPortal(<div style={{ pointerEvents: "auto" }} onKeyDown={event => {
    event.stopPropagation();
    // Keep keyboard navigation inside the modal while its backdrop is open.
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (!buttons.length) { event.preventDefault(); return; }
    if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
    else if (!event.shiftKey && (index < 0 || index === buttons.length - 1)) { event.preventDefault(); buttons[0].focus(); }
  }}>
    <GlassPane open onClose={onClose} closeLabel="return to naming" closeDisabled={busy} labelledBy="save-memory-title">
      <h2 id="save-memory-title" style={{ ...TITLE, color: CHROME_GRAY, margin: 0, textAlign: "center" }}>Keep a copy of your memory</h2>
      <div style={{ fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.65, color: CHROME_GRAY }}>
        <p style={{ margin: 0 }}>You are exploring <em>nijimu</em> as a guest. Your memory will remain in the gallery during this visit, but won't be saved or shared publicly.</p>
        <p style={{ margin: "1.65em 0 0" }}>Download an image to keep it with you.</p>
      </div>
      {(error || storageError) && <p role="alert" style={{ fontFamily: SERIF, fontSize: BODY_SIZE, color: CHROME_GRAY, margin: 0 }}>{error || storageError}</p>}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%" }}>
        <PillButton label={busy ? "preparing your memory…" : "download memory"} disabled={busy} style={{ width: "100%" }}
          onClick={() => { if (busy) return; attempt.current++; captured.current = false; setError(null); setBusy(true); }} />
        <TextButton label="continue without download" disabled={busy} onClick={onContinue} />
      </div>
    </GlassPane>
    {busy && <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: 960, height: 960, pointerEvents: "none" }}>
      <VesselArtifact cacheKey={`export-${session.draftId}|${attempt.current}`} form={vessel.form} morph={vessel.tune.morph}
        photoUrl={vessel.url || undefined} seed={vessel.seed} tune={vessel.tune} room={vessel.room}
        glassMode={vessel.mode} sheetMode={vessel.sheetMode} face={vessel.face} sheetSize={vessel.tune.sheetSize}
        still focused={false} frameloop="always" onReady={canvas => { void exportFrame(canvas); }} />
    </div>}
  </div>, document.body);
}
