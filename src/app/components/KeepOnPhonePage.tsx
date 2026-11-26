import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router";
import { CHROME_GRAY } from "../lib/colors";
import { BODY_SIZE, SERIF } from "../lib/theme";
import { TextButton } from "./TextButton";
import { PaperFinish } from "./PaperFinish";
import { useT } from "../lib/i18n";

/** The paper the card is shown on (the gallery's ground, a shade lighter). */
const PAPER = "#f0efee";
const NOTE = { fontFamily: SERIF, fontSize: BODY_SIZE, lineHeight: 1.45, color: CHROME_GRAY, margin: 0, textAlign: "center" as const };

type Kept =
  | { status: "loading" }
  | { status: "ready"; file: File; url: string; expiresAt: string | null }
  | { status: "gone" }
  | { status: "failed" };

/**
 * /keep/:id — what a phone opens from the save dialog's QR code: the memory's card, and a way to
 * save it to the phone's photos (the share sheet where the browser offers files to it, else a
 * download; pressing and holding the image works everywhere). Outside the layout: no music, no
 * gallery, nothing else loads. The image is fetched once on arrival, so the share runs straight
 * from the press (Safari drops the gesture across a fetch).
 */
export function KeepOnPhonePage() {
  const { id = "" } = useParams();
  const [kept, setKept] = useState<Kept>({ status: "loading" });
  const ui = useT();
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = ui.keepPageTitle;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [ui.keepPageTitle]);

  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`, { signal: abort.signal });
        if (res.status === 404 || res.status === 410) { setKept({ status: "gone" }); return; }
        if (!res.ok) { setKept({ status: "failed" }); return; }
        const blob = await res.blob();
        const file = new File([blob], "nijimu-memory.jpg", { type: blob.type || "image/jpeg" });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setKept({ status: "ready", file, url, expiresAt: res.headers.get("X-Expires-At") });
      } catch {
        if (!abort.signal.aborted) setKept({ status: "failed" });
      }
    })();
    return () => {
      abort.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [id]);

  const save = async () => {
    if (kept.status !== "ready") return;
    const files = [kept.file];
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return; // closed the sheet
      }
    }
    const a = document.createElement("a");
    a.href = kept.url;
    a.download = kept.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <main style={{ position: "relative", minHeight: "100dvh", background: PAPER, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 44 /* card to button; was 24 */, padding: "72px 20px calc(32px + env(safe-area-inset-bottom))",
      boxSizing: "border-box" }}>
      <PaperFinish fine zIndex={0} />
      {kept.status === "ready" && <>
        <img src={kept.url} alt={ui.keepCardAlt} draggable={false}
          style={{ position: "relative", zIndex: 1, display: "block", maxWidth: "100%", maxHeight: "68dvh", width: "auto", height: "auto",
            boxShadow: "0 1px 2px rgba(60, 60, 70, 0.05), 0 18px 48px rgba(60, 60, 70, 0.08)",
            // a long press keeps the image (iOS: "Save to Photos")
            WebkitTouchCallout: "default" } as CSSProperties} />
        {/* the image and one way to keep it, nothing else (2026-11-25: no wordmark, no notes) */}
        <TextButton label={ui.saveToPhotos} onClick={() => { void save(); }} style={{ position: "relative", zIndex: 1 }} />
      </>}
      {kept.status === "loading" && <p style={{ ...NOTE, position: "relative", zIndex: 1, opacity: .7 }}>{ui.openingMemory}</p>}
      {kept.status === "gone" && <p style={{ ...NOTE, position: "relative", zIndex: 1, maxWidth: "28em" }}>
        {ui.keepGone}
      </p>}
      {kept.status === "failed" && <p style={{ ...NOTE, position: "relative", zIndex: 1, maxWidth: "28em" }}>
        {ui.keepFailed}
      </p>}
    </main>
  );
}
