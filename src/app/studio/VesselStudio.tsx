import { useEffect, useMemo, useRef, useState } from "react";
import { DialRoot, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import { buildArchive } from "../lib/archive";
import { setFilmTune } from "../lib/filmTune";
import { blobToDataUrl, deleteSaved, listSaved, loadSaved, photoBlob, saveVessel, type SavedSummary } from "./savedVessels";
import { galleryTune } from "../lib/galleryTune";
import { createArtifactForm, type ArtifactCategory } from "../lib/superformula";
import { SANS } from "../lib/theme";
import { CHROME_GRAY } from "../lib/colors";
import { VesselArtifact, setSeatPhotoMax } from "../lab/VesselArtifact";
import { galleryStateFor } from "../lab/VesselGalleryPreview";
import {
  STUDIO_DEFAULT, parseSettings, settingsFrom, studioConfig, tuneDiff, valuesFor, vesselConfig,
  type ExportBackground, type StudioSettings,
} from "./studioSettings";

/*
 * /studio — the vessel on its own, to tune its 3D look and export it. Apart
 * from the experience: no header, no music, no gallery around it, and what is
 * moved here reaches nothing else. The vessel is drawn by the gallery's own
 * renderer (VesselArtifact: refraction, the draped strip, the film look,
 * reflection, sheen, the memory's stain), so a look settled here is the look
 * a seat would wear.
 *
 * Two DialKit panels: "studio" (top left) — a memory to start from, the form,
 * the photo, the look's modes, the view, the frame and backdrop, export — and
 * "vessel" (top right) — every knob of the glass, strip, film, colour, light,
 * reflection and sheen. Both persist in localStorage (nijimu-studio*), and
 * DialKit's version menu keeps named presets.
 *
 * Export: a PNG of the frame at a chosen long side, with the backdrop or
 * transparent (the vessel is re-rendered at that density, not scaled up), and
 * the settings as a .json file that "import settings…" reads back.
 */

// exports want the picture sharper than a gallery seat keeps it
setSeatPhotoMax(2400);

const MAX_CANVAS = 8192;
const wrapDegrees = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

type Values = Record<string, Record<string, unknown>>;

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

function backdropCss(b: StudioSettings["backdrop"]): string {
  if (b.kind === "solid") return b.top;
  if (b.kind === "gradient") return `linear-gradient(${b.top}, ${b.bottom})`;
  return "repeating-conic-gradient(#e2e2e2 0% 25%, #f4f4f4 0% 50%) 0 0 / 16px 16px";
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");

export function VesselStudio() {
  const [memories] = useState(() => buildArchive());
  const [saved, setSaved] = useState<SavedSummary[]>([]);
  const refreshSaved = () => listSaved().then(setSaved, () => setSaved([]));
  useEffect(() => { void refreshSaved(); }, []);
  const studioCfg = useMemo(() => studioConfig(
    STUDIO_DEFAULT,
    memories.map((m) => ({ value: m.id, label: `${m.year} · ${m.event.length > 24 ? `${m.event.slice(0, 23)}…` : m.event}` })),
    saved.map((v) => ({ value: v.id, label: `${v.name} · ${new Date(v.savedAt).toLocaleDateString()}` })),
  ), [memories, saved]);
  const vesselCfg = useMemo(() => vesselConfig(STUDIO_DEFAULT), []);
  const onAction = useRef<(path: string) => void>(() => undefined);
  const studio = useDialKitController("studio", studioCfg as never, { id: "nijimu-studio", persist: true, onAction: (a) => onAction.current(a) });
  const vessel = useDialKitController("vessel", vesselCfg as never, { id: "nijimu-studio-vessel", persist: true });
  const studioValues = studio.values as unknown as Values;
  const vesselValues = vessel.values as unknown as Values;
  const s = useMemo(() => settingsFrom(studioValues, vesselValues, STUDIO_DEFAULT), [studioValues, vesselValues]);

  // dev: the panels within reach of a script (checks by screenshot)
  if (import.meta.env.DEV) (window as unknown as { __studio?: unknown }).__studio = { studio, vessel };
  // the film look is one store for every vessel on the page
  useEffect(() => { setFilmTune(s.film); }, [s.film]);

  const [viewReset, setViewReset] = useState(0);
  const [exportDpr, setExportDpr] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState("");
  const capture = useRef<((frame: HTMLCanvasElement) => void) | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const seatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  // the frame: the aspect, as large as the room between the two panels allows
  const vp = useViewport();
  const [aw, ah] = s.frame.aspect.split(":").map(Number);
  const wide = vp.w > 1100;
  const roomW = Math.max(200, vp.w - (wide ? 2 * 300 : 32));
  const roomH = Math.max(200, vp.h - 96);
  const k = Math.min(roomW / aw, roomH / ah);
  const fw = Math.round(aw * k), fh = Math.round(ah * k);
  const seat = Math.round(s.frame.size * Math.min(fw, fh));
  const seatLeft = fw / 2 + s.frame.x * fw - seat / 2;
  const seatTop = fh / 2 + s.frame.y * fh - seat / 2;
  const reflection = s.reflection.strength > 0 ? s.reflection : undefined;

  const say = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus((now) => (now === text ? "" : now)), 4000);
  };

  const apply = (next: StudioSettings) => {
    const v = valuesFor(next);
    studio.setValues(v.studio as never);
    vessel.setValues(v.vessel as never);
    setViewReset((n) => n + 1);
  };

  const exportPng = async (long: number, background: ExportBackground) => {
    const canvas = seatRef.current?.querySelector("canvas");
    const frame = frameRef.current;
    if (!canvas || !frame) { say("the vessel is still being built"); return; }
    const scale = long / Math.max(fw, fh);
    const css = { w: canvas.clientWidth, h: canvas.clientHeight };
    const dpr = Math.min(scale, MAX_CANVAS / Math.max(css.w, css.h));
    say("rendering…");
    setExportDpr(dpr);
    try {
      // wait for the canvas and its targets to take the new density, then take a frame drawn at it
      const want = Math.round(css.w * dpr);
      let shot: HTMLCanvasElement | null = null;
      for (let tries = 0; tries < 60 && !shot; tries++) {
        await nextFrame();
        if (tries < 3) continue;
        const got = await new Promise<HTMLCanvasElement>((resolve, reject) => {
          capture.current = resolve;
          window.setTimeout(() => reject(new Error("no frame")), 4000);
        });
        if (Math.abs(got.width - want) <= 2) shot = got;
      }
      if (!shot) throw new Error("the canvas did not reach the export size");
      const W = Math.round(fw * scale), H = Math.round(fh * scale);
      const out = document.createElement("canvas");
      out.width = W; out.height = H;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no 2d canvas");
      if (background === "backdrop" && s.backdrop.kind !== "transparent") {
        if (s.backdrop.kind === "gradient") {
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, s.backdrop.top);
          g.addColorStop(1, s.backdrop.bottom);
          ctx.fillStyle = g;
        } else ctx.fillStyle = s.backdrop.top;
        ctx.fillRect(0, 0, W, H);
      }
      const fr = frame.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(shot, (cr.left - fr.left) * scale, (cr.top - fr.top) * scale, cr.width * scale, cr.height * scale);
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
      if (!blob) throw new Error("the image could not be encoded");
      download(blob, `nijimu-vessel-${stamp()}.png`);
      say(`exported ${W} × ${H}`);
    } catch (err) {
      say(`export failed: ${(err as Error).message}`);
    } finally {
      capture.current = null;
      setExportDpr(undefined);
    }
  };

  onAction.current = (path: string) => {
    const name = path.split(".").pop();
    const v = studio.getValues() as unknown as Values;
    if (name === "save") {
      const typed = String(v.saved?.name ?? "").trim();
      const label = typed || `vessel ${saved.length + 1}`;
      say("saving…");
      saveVessel(label, s).then(async ({ id, replaced }) => {
        await refreshSaved();
        studio.setValues({ saved: { name: label, vessel: id } } as never);
        say(replaced ? `updated “${label}”` : `saved “${label}”`);
      }, (err: Error) => say(`could not save: ${err.message}`));
    } else if (name === "open") {
      const id = String(v.saved?.vessel ?? "");
      if (!id) { say("choose a kept vessel first"); return; }
      loadSaved(id).then((got) => {
        if (!got) { say("that vessel is no longer kept"); void refreshSaved(); return; }
        apply(got.settings);
        studio.setValues({ saved: { name: got.name } } as never);
        say(`loaded “${got.name}”`);
      }, (err: Error) => say(`could not load: ${err.message}`));
    } else if (name === "remove") {
      const id = String(v.saved?.vessel ?? "");
      const item = saved.find((x) => x.id === id);
      if (!item) { say("choose a kept vessel first"); return; }
      if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
      deleteSaved(id).then(async () => {
        await refreshSaved();
        studio.setValues({ saved: { vessel: "" } } as never);
        say(`deleted “${item.name}”`);
      }, (err: Error) => say(`could not delete: ${err.message}`));
    } else if (name === "draw") {
      const category = (v.form?.category as ArtifactCategory) ?? s.form.category;
      const form = createArtifactForm({ seed: `studio|${category}|${Date.now()}`, category });
      studio.setValues({ form: valuesFor({ ...s, form }).studio.form } as never);
    } else if (name === "load") {
      const item = memories.find((m) => m.id === v.source?.memory);
      if (!item) { say("choose a memory first"); return; }
      const state = galleryStateFor(item);
      const g = galleryTune();
      apply({
        ...s,
        form: state.form, tune: { ...state.tune }, mode: state.mode, sheetMode: state.sheetMode, face: state.face, room: { ...state.room },
        photo: state.url || s.photo, seed: state.seed, fitSheet: false,
        reflection: { ...g.reflection }, sheen: { ...g.sheen },
        view: { around: wrapDegrees((state.facing ?? state.tune.anchorAngle) - state.tune.anchorAngle), pitch: state.viewPitch ?? state.tune.pitch },
      });
      say(`loaded ${item.year} · ${item.event}`);
    } else if (name === "reset") {
      setViewReset((n) => n + 1);
    } else if (name === "png") {
      if (busy.current) return;
      busy.current = true;
      void exportPng(Number(v.export?.resolution) || 3000, v.export?.background === "transparent" ? "transparent" : "backdrop")
        .finally(() => { busy.current = false; });
    } else if (name === "settings") {
      // the photo goes in the file as data, so the file stands on its own
      photoBlob(s.photo).then((b) => (b ? blobToDataUrl(b) : ""), () => s.photo).then((photo) => {
        download(new Blob([JSON.stringify({ ...s, photo }, null, 2)], { type: "application/json" }), `nijimu-vessel-${stamp()}.json`);
        say("settings downloaded");
      });
    } else if (name === "import") {
      fileRef.current?.click();
    } else if (name === "copy") {
      navigator.clipboard.writeText(tuneDiff(s.tune)).then(() => say("tune diff copied"), () => say("the clipboard refused"));
    }
  };

  const facing = wrapDegrees(s.tune.anchorAngle + s.view.around);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#dededd", fontFamily: SANS, color: CHROME_GRAY, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", paddingBottom: 40 }}>
        <div ref={frameRef}
          style={{ position: "relative", width: fw, height: fh, background: backdropCss(s.backdrop), overflow: "hidden", boxShadow: "0 1px 2px #0000000d, 0 12px 40px #00000012" }}>
          {/* the seat is the square the vessel is framed in; its reflection's room hangs below it */}
          <div ref={seatRef} style={{ position: "absolute", left: seatLeft, top: seatTop, width: seat, height: seat }}>
              <VesselArtifact
                cacheKey="studio"
                form={s.form}
                morph={s.tune.morph}
                photoUrl={s.photo || undefined}
                seed={s.seed}
                tune={s.tune}
                room={s.room}
                glassMode={s.mode}
                sheetMode={s.sheetMode}
                face={s.face}
                sheetSize={s.fitSheet ? undefined : s.tune.sheetSize}
                focused
                still={false}
                frameloop="always"
                holdView
                facing={facing}
                viewPitch={s.view.pitch}
                viewToken={`${s.view.around}|${s.view.pitch}|${viewReset}`}
                reflection={reflection}
                sheen={s.sheen}
                pixelScale={1}
                dpr={exportDpr}
                capture={capture}
              />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontSize: 11, letterSpacing: ".02em", pointerEvents: "none" }}>
        {status || `vessel studio · ${fw} × ${fh} frame · drag the vessel to turn it`}
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          file.text().then((text) => { apply(parseSettings(text)); say(`imported ${file.name}`); })
            .catch((err: Error) => say(`import failed: ${err.message}`));
        }} />
      <DialRoot position="top-left" theme="light" productionEnabled panels={["studio"]} />
      <DialRoot position="top-right" theme="light" productionEnabled panels={["vessel"]} />
    </main>
  );
}
