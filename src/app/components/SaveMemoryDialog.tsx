import { PANE_CONTENT_GAP } from "../lib/theme";
import { CHROME_GRAY } from "../lib/colors";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowIcon, DownloadIcon, PANE_BODY, PANE_TITLE, PaneOption, PaneOptions, PhoneIcon } from "./PaneOption";
import { keepForPhone, qrCodeOf } from "../lib/shareToPhone";
import type { NamingSession } from "./NamingRim";
import { draftArtifactOf } from "../lib/namingDraft";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import { VesselArtifact } from "../lab/VesselArtifact";
import type { Room } from "../lab/VesselPreview";
import { withNamingLights } from "../lib/namingTune";
import { CARD_SCALE, copyArtifactFrame, downloadMemoryImage, memoryImage } from "../lib/memoryImage";
import { useCompact } from "../hooks/useCompact";
import { askCardFrame } from "../lib/cardFrame";

/* The card photographs the vessel as the gallery wears it: its lighter stain
   (strength, foot band, flash), its glass and its room, with naming's two lights. */
const CARD_STAIN = { memoryTintAmount: .21, memoryTintDepth: .47, memoryFlash: .85 };
const CARD_GLASS = { bend: .67, glassSoft: .9, photoOpacity: .78 };
const CARD_ROOM: Room = { above: "#eae7e6", below: "#ffffff" };
/** The vessel dressed for its card: the gallery's state for this draft, its glass, its room and (if it has
    a colour) its lighter stain, with naming's two lights. Shared by the dialog's own render and the naming
    vessel, which dresses so for a moment to hand the card its frame (lib/cardFrame.ts). */
export function cardVesselOf(session: NamingSession) {
  const state = galleryStateFor(draftArtifactOf(session));
  const stained = state.tune.memoryTintAmount > 0;
  return { ...state, room: CARD_ROOM, tune: withNamingLights({ ...state.tune, ...CARD_GLASS, ...(stained ? CARD_STAIN : {}) }) };
}
/** The card's frame is a square of this many css px at CARD_SCALE (1920 device px), however it is made. */
export const CARD_FRAME_PX = 960;
/** How long the dialog waits for the naming vessel to hand it a frame before rendering one itself (that
    fallback costs a WebGL context, the very thing that can cost the pond its own, so it waits generously;
    the frame comes in well under a second where frames run freely). */
const BORROW_WAIT_MS = 6000;
/** The card's page (memoryImage: 1200 × 1750 units). */
const CARD_ASPECT = 1200 / 1750;
/** The card's paper before its picture has come, a shade of the room it is printed in. */
const CARD_PAPER = "#efedec";
/** How the card and the words come in, and the card's picture once it is made. */
const ENTER_MS = 700;
const PICTURE_IN_MS = 900;
/** The QR code's ink: the header's wordmark grey (CHROME_GRAY; was the darker #45454a). */
const QR_INK = CHROME_GRAY;
const QR_PX = 168;
/** Save to phone is for a desktop: a screen wide enough and a mouse. A phone downloads instead. */
const desktopPointer = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

type PhoneState =
  | { status: "waiting" } // for the card, then sending it
  | { status: "ready"; link: string; qr: string }
  | { status: "failed"; error: string };

/**
 * After "save memory": the memory's card — the image a download keeps (memoryImage) — made as the dialog
 * opens and shown in the vessel's place (naming fades its vessel and fields away meanwhile), with the
 * dialog's words to its right, centred on it and set from the left; on a phone, under it. No glass pane:
 * the card is the thing shown. "Download as image" keeps the card already made (waiting for it if it is
 * not yet); Escape or a press off the card and words goes back to naming.
 */
export function SaveMemoryDialog({ session, title, year, onClose, onContinue, storageError }: {
  session: NamingSession; title: string; year: string;
  onClose: () => void; onContinue: () => void;
  storageError?: string | null;
}) {
  const compact = useCompact();
  /** The card, once made: the PNG a download keeps, and a URL to show it by. */
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  /** A download asked for before the card was ready: it goes as soon as the card is made. */
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const captured = useRef(false);
  const live = useRef(true);
  const [shown, setShown] = useState(false);
  const firstButton = useRef<HTMLDivElement>(null);
  const toPhone = !compact && desktopPointer();
  /** "phone": the QR code in the words' place; null: the choice. */
  const [phone, setPhone] = useState<PhoneState | null>(null);
  const phoneRun = useRef(0);
  const vessel = useMemo(() => cardVesselOf(session), [session]);
  /* The card's frame comes from the naming vessel, borrowed (no WebGL context of its own: one more was
     enough to make the browser drop the pond's). Only if none answers does the dialog render it itself. */
  const [ownRender, setOwnRender] = useState(false);
  useEffect(() => {
    if (card || failed || ownRender) return;
    const withdraw = askCardFrame(canvas => { void makeCard(canvas); });
    const wait = window.setTimeout(() => { withdraw(); setOwnRender(true); }, BORROW_WAIT_MS);
    return () => { window.clearTimeout(wait); withdraw(); };
    // makeCard reads the latest props through its own closure each time it is asked for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, card, failed, ownRender]);

  useEffect(() => {
    live.current = true;
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setShown(true)); });
    return () => { live.current = false; cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);
  useEffect(() => {
    firstButton.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    // Escape belongs to this dialog, not the pond's underlying Back shortcut.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // the QR code steps back to the choice; the choice closes
      if (phone) { phoneRun.current++; setPhone(null); return; }
      if (!waiting) onClose();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [waiting, onClose, phone]);
  // the card goes up once it is made and the phone has been asked for (the press is the consent)
  useEffect(() => {
    if (phone?.status !== "waiting" || !card) return;
    const run = ++phoneRun.current;
    const abort = new AbortController();
    void (async () => {
      const kept = await keepForPhone(card.blob, abort.signal);
      if (run !== phoneRun.current || !live.current) return;
      if ("error" in kept) { setPhone({ status: "failed", error: kept.error }); return; }
      try {
        const qr = await qrCodeOf(kept.link, QR_INK);
        if (run === phoneRun.current && live.current) setPhone({ status: "ready", link: kept.link, qr });
      } catch {
        if (run === phoneRun.current && live.current) setPhone({ status: "failed", error: "The code couldn’t be drawn. Please try again." });
      }
    })();
    return () => abort.abort();
  }, [phone?.status, card]);
  useEffect(() => {
    if (failed && phone?.status === "waiting") setPhone({ status: "failed", error: "The image couldn’t be prepared. Please try again." });
  }, [failed, phone?.status]);
  // a card that never comes: say so, and let the guest try again or go on
  useEffect(() => {
    if (card || failed) return;
    const timer = window.setTimeout(() => { setFailed(true); captured.current = true; }, 30_000);
    return () => window.clearTimeout(timer);
  }, [card, failed, attempt]);
  useEffect(() => {
    if (!failed) return;
    setWaiting(false);
    setError("The image couldn’t be prepared. Please try again, or continue without downloading.");
  }, [failed]);
  // a download asked for early goes once the card is there
  useEffect(() => {
    if (!waiting || !card) return;
    downloadMemoryImage(card.blob, title);
    setWaiting(false);
    onContinue();
  }, [waiting, card, title, onContinue]);

  const makeCard = async (canvas: HTMLCanvasElement) => {
    if (captured.current) return;
    captured.current = true;
    try {
      const frame = copyArtifactFrame(canvas);
      // The room takes the tone the glass wears, read from the same tune.
      const tone = vessel.tune.memoryTintAmount > 0
        ? { l: vessel.tune.memoryTintLight, c: vessel.tune.memoryTintChroma, h: vessel.tune.memoryTintHue }
        : undefined;
      const blob = await memoryImage(frame, title, year, session.state.transcript ?? "", tone);
      if (!live.current) return;
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch {
      if (live.current) setFailed(true);
    }
  };
  const download = () => {
    if (waiting) return;
    if (card) { downloadMemoryImage(card.blob, title); onContinue(); return; }
    setError(null);
    if (failed) {
      // try again from the start: a fresh frame of the vessel, borrowed first
      setFailed(false);
      setOwnRender(false);
      captured.current = false;
      setAttempt(n => n + 1);
    }
    setWaiting(true);
  };

  const saveToPhone = () => {
    if (waiting) return;
    setError(null);
    if (failed) {
      setFailed(false);
      setOwnRender(false);
      captured.current = false;
      setAttempt(n => n + 1);
    }
    setPhone({ status: "waiting" });
  };
  const leavePhone = () => { phoneRun.current++; setPhone(null); };

  const cardHeight = compact ? "min(46dvh, 112vw)" : "min(78dvh, 960px)";
  const appear = (delay = 0) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : "translateY(10px)",
    transition: `opacity ${ENTER_MS}ms ease ${delay}ms, transform ${ENTER_MS}ms cubic-bezier(0.22, 0.8, 0.28, 1) ${delay}ms`,
  });

  return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="save-memory-title"
    onClick={() => { if (!waiting) onClose(); }}
    onKeyDown={event => {
      event.stopPropagation();
      // Keep keyboard navigation inside the dialog while it is open.
      if (event.key !== "Tab") return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (!buttons.length) { event.preventDefault(); return; }
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && (index < 0 || index === buttons.length - 1)) { event.preventDefault(); buttons[0].focus(); }
    }}
    style={{
      position: "fixed", inset: 0, zIndex: 99990, pointerEvents: "auto",
      display: "flex", flexDirection: compact ? "column" : "row", alignItems: "center", justifyContent: "center",
      gap: compact ? 28 : "clamp(40px, 5vw, 72px)",
      padding: compact ? "72px var(--chrome-inset, 18px) 32px" : "0 clamp(24px, 6vw, 96px)",
      overflowY: compact ? "auto" : undefined,
    }}>
    <style>{`
      .nijimuSaveCopy > p { margin: 0; }
      .nijimuSaveCopy > p + p { margin-top: .4em; }
    `}</style>
    {/* the card: its paper first, its picture fading in over it once made */}
    <div onClick={event => event.stopPropagation()} aria-label={`the memory's card: ${title}, ${year}`} role="img"
      style={{ position: "relative", flex: "none", height: cardHeight, aspectRatio: `${CARD_ASPECT}`, maxWidth: "100%",
        // no shadow: the card lies in the scene, the pond showing round it
        background: CARD_PAPER,
        ...appear() }}>
      {card && <img src={card.url} alt="" draggable={false} data-card-in
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          animation: `nijimuCardIn ${PICTURE_IN_MS}ms ease both` }} />}
      <style>{`@keyframes nijimuCardIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { [data-card-in] { animation: none; } }`}</style>
    </div>
    {/* the words, beside the card and centred on it, from the left */}
    <div ref={firstButton} onClick={event => event.stopPropagation()}
      style={{ flex: "none", width: compact ? "100%" : "min(360px, 32vw)", display: "flex", flexDirection: "column",
        gap: PANE_CONTENT_GAP * 1.5, textAlign: "left", ...appear(120) }}>
      {phone ? <PhoneHandoff phone={phone} onDone={onContinue} onBack={leavePhone} onRetry={saveToPhone} /> : <>
      <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
        <h2 id="save-memory-title" style={{ ...PANE_TITLE, margin: 0 }}>Keep a copy of your memory</h2>
        <div className="nijimuSaveCopy" style={PANE_BODY}>
          <p>You’re exploring nijimu as a guest. Your memory will remain in the gallery during this visit, but won’t be saved or shared publicly.</p>
          <p>Download an image to take a piece of it with you.</p>
        </div>
        {(error || storageError) && <p role="alert" style={{ ...PANE_BODY, margin: 0 }}>{error || storageError}</p>}
      </div>
      <PaneOptions>
        <PaneOption primary mark={<DownloadIcon />} label={waiting ? "Preparing your memory…" : "Download as image"} disabled={waiting}
          onClick={download} />
        {toPhone && <PaneOption mark={<PhoneIcon />} label="Save to your phone" disabled={waiting} onClick={saveToPhone} />}
        <PaneOption mark={<ArrowIcon />} label="Continue without download" disabled={waiting} onClick={onContinue} />
      </PaneOptions>
      </>}
    </div>
    {/* the vessel, rendered out of sight once to make the card — only when no naming vessel lent its frame */}
    {ownRender && !card && !failed && <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: CARD_FRAME_PX, height: CARD_FRAME_PX, pointerEvents: "none" }}>
      <VesselArtifact cacheKey={`export-${session.draftId}|${attempt}`} form={vessel.form} morph={vessel.tune.morph}
        photoUrl={vessel.url || undefined} seed={vessel.seed} tune={vessel.tune} room={vessel.room}
        glassMode={vessel.mode} sheetMode={vessel.sheetMode} face={vessel.face} sheetSize={vessel.tune.sheetSize}
        still focused={false} frameloop="always" dpr={CARD_SCALE} onReady={canvas => { void makeCard(canvas); }} />
    </div>}
  </div>, document.body);
}

/** The words' column while saving to a phone: the QR code, what it does, and how long it is kept. */
function PhoneHandoff({ phone, onDone, onBack, onRetry }: {
  phone: PhoneState; onDone: () => void; onBack: () => void; onRetry: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true }); }, [phone.status]);
  return <div ref={box} style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP * 1.5 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: PANE_CONTENT_GAP }}>
      <h2 id="save-memory-title" style={{ ...PANE_TITLE, margin: 0 }}>Save it to your phone</h2>
      <div className="nijimuSaveCopy" style={PANE_BODY}>
        <p>Scan the code with your phone’s camera to open and save your image. The following link will be valid for a day.</p>
      </div>
    </div>
    <div aria-live="polite" style={{ width: QR_PX, height: QR_PX, position: "relative" }}>
      {phone.status === "ready"
        ? <img src={phone.qr} width={QR_PX} height={QR_PX} alt={`QR code for ${phone.link}`} draggable={false}
            style={{ display: "block", width: QR_PX, height: QR_PX, animation: `nijimuCardIn ${PICTURE_IN_MS}ms ease both` }} />
        : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-start",
            ...PANE_BODY, opacity: phone.status === "failed" ? 1 : .7 }}>
            {phone.status === "failed" ? <span role="alert">{phone.error}</span> : "Preparing the code…"}
          </div>}
    </div>
    <PaneOptions>
      {phone.status === "failed"
        ? <PaneOption primary mark={<PhoneIcon />} label="Try again" onClick={onRetry} />
        : <PaneOption primary mark={<ArrowIcon />} label="Done" disabled={phone.status !== "ready"} onClick={onDone} />}
      <PaneOption label="Back" onClick={onBack} />
    </PaneOptions>
  </div>;
}
