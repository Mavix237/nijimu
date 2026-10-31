import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { LIFE_EVENTS } from "../data/memoryData";
import { CHROME_GRAY } from "../lib/colors";
import { carouselFrame } from "../lib/carouselLayout";
import { META, NOTE_SIZE, SANS } from "../lib/theme";
import { getArtifactMesh, type ArtifactForm } from "../lib/superformula";
import {
  EARLIER_SHAPES, LIBRARY_SIZE, PLACEMENT_DEFAULT, SHAPE_CANDIDATES, Y_SERIES,
  entrySignature, forgetGalleryLibrary, galleryLibrary, libraryEntry, loadGalleryLibrary, saveGalleryLibrary, useGalleryLibrary,
  type LibraryEntry, type ShapeCandidate, type ShapePlacement,
} from "../lib/galleryLibrary";
import { PageHeader } from "../components/PageHeader";
import { TextButton } from "../components/TextButton";
import { VesselArtifact, vesselCanvasScale } from "./VesselArtifact";
import { PHOTOS, VESSEL_GALLERY_TUNE, libraryVessel, memoryPhoto, slotPhotoIndex } from "./VesselGalleryPreview";
import { PITCH_MAX, PITCH_MIN } from "./VesselPreview";

/*
 * /lab/shapes — choosing the gallery's library. Thirty-four candidates: the
 * sixteen shapes the gallery drew before the Y series and the eighteen Y
 * shapes. Sixteen are chosen, in memory order, each with its size in the seat
 * and where its picture hangs; "save to library" keeps them on this machine
 * and /memory wears them. Only the shape in focus is a live vessel (a browser
 * keeps about sixteen WebGL canvases at once); the rest are drawn flat.
 */

const BY_KEY = new Map(SHAPE_CANDIDATES.map((c) => [c.key, c]));
const INK = "#6f6f7a";
const FAINT = "rgba(123, 123, 135, 0.14)";

type Placements = Record<string, ShapePlacement>;

const SLIDERS: { key: Exclude<keyof ShapePlacement, "view" | "photo">; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: "size", label: "size", min: 0.5, max: 1.6, step: 0.01 },
  { key: "photoHeight", label: "picture height", min: 0.3, max: 1, step: 0.01 },
  { key: "photoAround", label: "picture around", min: -180, max: 180, step: 1, unit: "°" },
  { key: "photoSize", label: "picture size", min: 0.5, max: 1.4, step: 0.01 },
];

function placementOf(e: LibraryEntry, index: number): ShapePlacement {
  return {
    size: e.size, photoHeight: e.photoHeight, photoAround: e.photoAround, photoSize: e.photoSize,
    photo: e.photo ?? slotPhotoIndex(index), view: e.view,
  };
}

const wrapDegrees = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const viewSig = (v: ShapePlacement["view"]) => (v ? `${v.around}|${v.pitch}` : "free");

function initialChoice(entries: LibraryEntry[]) {
  const chosen: string[] = [];
  const placements: Placements = {};
  for (const e of entries) {
    if (!BY_KEY.has(e.key) || chosen.includes(e.key)) continue;
    placements[e.key] = placementOf(e, chosen.length);
    chosen.push(e.key);
  }
  return { chosen, placements };
}

const sameEntries = (a: LibraryEntry[], b: LibraryEntry[]) =>
  a.length === b.length && a.every((e, i) =>
    entrySignature(e) === entrySignature(b[i]) && e.size === b[i].size && viewSig(e.view) === viewSig(b[i].view)
    && (e.photo ?? slotPhotoIndex(i)) === (b[i].photo ?? slotPhotoIndex(i)));

/* ───────── flat drawings of the candidates ───────── */

const easeMorph = (m: number) => m * m * (3 - 2 * m);
const thumbs = new Map<string, string>();

/** The form drawn flat, a little from above and turned, its faces shaded toward a key light. */
function thumbnail(key: string, form: ArtifactForm, morph: number, px: number): string {
  const id = `${key}|${morph}|${px}`;
  const hit = thumbs.get(id);
  if (hit) return hit;
  const mesh = getArtifactMesh(form);
  const e = easeMorph(morph);
  const n = mesh.positions.length / 3;
  const yaw = 0.55, tilt = 0.32;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  let reach = 0.01;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    const x0 = mesh.sphere[k] + (mesh.positions[k] - mesh.sphere[k]) * e;
    const y0 = mesh.sphere[k + 1] + (mesh.positions[k + 1] - mesh.sphere[k + 1]) * e;
    const z0 = mesh.sphere[k + 2] + (mesh.positions[k + 2] - mesh.sphere[k + 2]) * e;
    const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
    const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;
    xs[i] = x1; ys[i] = y2; zs[i] = z2;
    reach = Math.max(reach, Math.hypot(x1, y2));
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d")!;
  const s = (px * 0.44) / reach, c = px / 2;
  const idx = mesh.index;
  const tris: { z: number; a: number; b: number; d: number; shade: number }[] = [];
  const light = [-0.45, 0.6, 0.66];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], d = idx[t + 2];
    const ux = xs[b] - xs[a], uy = ys[b] - ys[a], uz = zs[b] - zs[a];
    const vx = xs[d] - xs[a], vy = ys[d] - ys[a], vz = zs[d] - zs[a];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lit = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
    tris.push({ z: zs[a] + zs[b] + zs[d], a, b, d, shade: 0.35 + 0.65 * lit + 0.25 * (1 - nz) });
  }
  tris.sort((p, q) => p.z - q.z);
  for (const { a, b, d, shade } of tris) {
    const v = Math.round(150 + 95 * Math.min(1, shade));
    g.fillStyle = g.strokeStyle = `rgb(${v - 6}, ${v - 4}, ${v})`;
    g.beginPath();
    g.moveTo(c + xs[a] * s, c - ys[a] * s);
    g.lineTo(c + xs[b] * s, c - ys[b] * s);
    g.lineTo(c + xs[d] * s, c - ys[d] * s);
    g.closePath();
    g.fill();
    g.lineWidth = 0.4;
    g.stroke();
  }
  const url = canvas.toDataURL();
  thumbs.set(id, url);
  return url;
}

function Thumb({ shape, size }: { shape: ShapeCandidate; size: number }) {
  const [url, setUrl] = useState(() => thumbs.get(`${shape.key}|${shape.morph}|${size * 2}`) ?? "");
  useEffect(() => {
    if (url) return;
    // one at a time, off the first paint
    const id = window.setTimeout(() => setUrl(thumbnail(shape.key, shape.form, shape.morph, size * 2)), 0);
    return () => window.clearTimeout(id);
  }, [shape, size, url]);
  return url
    ? <img src={url} alt="" width={size} height={size} draggable={false} style={{ display: "block", width: size, height: size }} />
    : <span style={{ display: "block", width: size, height: size }} />;
}

/* ───────── the page ───────── */

export function ShapeLibraryLab() {
  const library = useGalleryLibrary();
  const [{ chosen, placements }, setChoice] = useState(() => initialChoice(library.entries));
  const [focus, setFocus] = useState<string>(() => chosen[0] ?? SHAPE_CANDIDATES[0].key);
  const [note, setNote] = useState("");
  const [screen, setScreen] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const candidate = BY_KEY.get(focus) ?? SHAPE_CANDIDATES[0];
  const placement = placements[focus] ?? PLACEMENT_DEFAULT;
  const slot = chosen.indexOf(focus);
  const full = chosen.length >= LIBRARY_SIZE;

  const entries = useMemo(() => chosen.map((k) => libraryEntry(BY_KEY.get(k)!, placements[k] ?? PLACEMENT_DEFAULT)), [chosen, placements]);
  const kept = loadGalleryLibrary();
  const unsaved = entries.length !== LIBRARY_SIZE || !kept || !sameEntries(entries, kept);

  // the vessel rebuilds its cloth when the picture moves; it follows the sliders a beat behind
  const entry = libraryEntry(candidate, placement);
  const [built, setBuilt] = useState(entry);
  const builtSig = entrySignature(built);
  useEffect(() => {
    if (entrySignature(entry) === builtSig) return;
    const id = window.setTimeout(() => setBuilt(entry), 140);
    return () => window.clearTimeout(id);
  });
  const previewIndex = slot >= 0 ? slot : 0;
  const photoIndex = placement.photo ?? slotPhotoIndex(previewIndex);
  const previewPhoto = memoryPhoto(previewIndex, photoIndex);
  const state = useMemo(() => libraryVessel(previewIndex, built, previewPhoto), [previewIndex, builtSig, previewPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  // the camera: where the drag has taken the eye, and the view the shape keeps when locked
  const view = placement.view;
  const usualFacing = VESSEL_GALLERY_TUNE.anchorAngle;
  const seen = useRef<{ around: number; pitch: number }>({ around: 0, pitch: VESSEL_GALLERY_TUNE.pitch });
  const viewToken = `${focus}|${viewSig(view)}`;
  const tokenSeen = useRef(viewToken);
  if (tokenSeen.current !== viewToken) {
    tokenSeen.current = viewToken;
    seen.current = view ? { ...view } : { around: 0, pitch: VESSEL_GALLERY_TUNE.pitch };
  }
  const onView = useCallback((facing: number, pitch: number) => {
    seen.current = { around: Math.round(wrapDegrees(facing - usualFacing)), pitch: Math.round(pitch) };
  }, [usualFacing]);

  const stage = { w: Math.max(320, screen.w - 380), h: screen.h };
  const apex = carouselFrame(screen.w, screen.h).size;
  const box = apex * vesselCanvasScale(built.form, built.morph) * placement.size;

  const place = (patch: Partial<ShapePlacement>) =>
    setChoice((c) => ({ ...c, placements: { ...c.placements, [focus]: { ...(c.placements[focus] ?? PLACEMENT_DEFAULT), ...patch } } }));
  const toggle = (key: string) => setChoice((c) => {
    if (c.chosen.includes(key)) return { ...c, chosen: c.chosen.filter((k) => k !== key) };
    if (c.chosen.length >= LIBRARY_SIZE) return c;
    return { chosen: [...c.chosen, key], placements: { ...c.placements, [key]: c.placements[key] ?? PLACEMENT_DEFAULT } };
  });
  const move = (key: string, by: number) => setChoice((c) => {
    const i = c.chosen.indexOf(key), j = i + by;
    if (i < 0 || j < 0 || j >= c.chosen.length) return c;
    const next = [...c.chosen];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...c, chosen: next };
  });
  const save = () => {
    try {
      saveGalleryLibrary(entries);
      setNote("kept — the gallery wears these now");
    } catch {
      setNote("could not keep it in this browser");
    }
  };
  const forget = () => {
    forgetGalleryLibrary();
    setChoice(initialChoice(galleryLibrary()));
    setNote("forgotten — the gallery wears the built-in library");
  };
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(""), 3200);
    return () => window.clearTimeout(id);
  }, [note]);

  const sectionTitle = { ...META, margin: "18px 0 8px", color: CHROME_GRAY } as const;

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: SANS, color: INK,
      background: "linear-gradient(#e6e7ea, #ffffff 70%)" }}>
      <PageHeader layout="absolute" carousel={false} tone="light" />
      <p style={{ ...META, position: "absolute", top: 26, left: 28, margin: 0, zIndex: 20, color: CHROME_GRAY }}>lab — shapes</p>

      {/* the shape in focus, at the size it will take in the gallery's apex seat */}
      <section aria-label="preview" style={{ position: "absolute", left: 0, top: 0, width: stage.w, height: stage.h }}>
        <div aria-hidden style={{ position: "absolute", left: stage.w / 2 - apex / 2, top: stage.h * 0.46 - apex / 2,
          width: apex, height: apex, border: `1px dashed ${FAINT}`, borderRadius: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: stage.w / 2 - box / 2, top: stage.h * 0.46 - box / 2, width: box, height: box }}>
          <VesselArtifact
            key={focus}
            cacheKey={`shapes-preview|${builtSig}`}
            form={state.form}
            morph={state.tune.morph}
            photoUrl={state.url || undefined}
            seed={state.seed}
            tune={state.tune}
            room={state.room}
            glassMode={state.mode}
            sheetMode={state.sheetMode}
            face={state.face}
            sheetSize={state.tune.sheetSize}
            facing={wrapDegrees(usualFacing + (view?.around ?? 0))}
            viewPitch={view?.pitch ?? VESSEL_GALLERY_TUNE.pitch}
            viewToken={viewToken}
            locked={!!view}
            onView={onView}
            focused
            still={false}
            frameloop="always"
          />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <p style={{ margin: 0, fontSize: NOTE_SIZE, color: INK }}>
            {candidate.name} <span style={{ color: CHROME_GRAY }}>· {candidate.note}</span>
            {slot >= 0
              ? <span style={{ color: CHROME_GRAY }}> — {LIFE_EVENTS[slot].year} · {LIFE_EVENTS[slot].event}</span>
              : <span style={{ color: CHROME_GRAY }}> — not in the library</span>}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {PHOTOS.map((url, i) => (
              <button key={url} type="button" aria-label={`use picture ${i + 1}`} onClick={() => place({ photo: i })}
                style={{ width: 34, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 2,
                  background: `center / cover url(${url})`, opacity: i === photoIndex ? 1 : 0.45,
                  outline: i === photoIndex ? `1px solid ${INK}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: NOTE_SIZE, color: CHROME_GRAY }}>
            {view ? "the view is locked" : "drag the vessel to turn it"} · the dashed square is the gallery's seat
          </p>
        </div>
      </section>

      <aside aria-label="library" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 380, padding: "64px 24px 28px",
        boxSizing: "border-box", overflowY: "auto", borderLeft: `1px solid ${FAINT}`, background: "rgba(240, 241, 240, 0.9)",
        backdropFilter: "blur(6px)", fontSize: NOTE_SIZE }}>

        <p style={{ ...sectionTitle, marginTop: 0 }}>{candidate.name}</p>
        <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
          <TextButton label={slot >= 0 ? `remove from the library` : full ? "the library is full" : "add to the library"}
            disabled={slot < 0 && full} onClick={() => toggle(focus)} />
          <TextButton label="reset" onClick={() => place(PLACEMENT_DEFAULT)} />
        </div>
        {SLIDERS.map(({ key, label, min, max, step, unit }) => (
          <label key={key} style={{ display: "block", marginBottom: 4 }}>
            <span style={{ display: "flex", justifyContent: "space-between", color: INK }}>
              <span>{label}</span>
              <span style={{ color: CHROME_GRAY, fontVariantNumeric: "tabular-nums" }}>
                {key === "photoAround" ? Math.round(placement[key]) : placement[key].toFixed(2)}{unit ?? ""}
              </span>
            </span>
            <input type="range" className="library-range" min={min} max={max} step={step} value={placement[key]}
              onChange={(e) => place({ [key]: Number(e.target.value) })} />
          </label>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, marginBottom: 4 }}>
          <span style={{ color: INK }}>camera</span>
          <span style={{ color: CHROME_GRAY, fontVariantNumeric: "tabular-nums" }}>
            {view ? `locked · ${view.around}° · pitch ${view.pitch}°` : "free"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
          {view
            ? <TextButton label="unlock" onClick={() => place({ view: null })} />
            : <TextButton label="lock this view" onClick={() => place({ view: { ...seen.current } })} />}
        </div>
        {view && ([
          { key: "around", label: "view around", min: -180, max: 180 },
          { key: "pitch", label: "view pitch", min: PITCH_MIN, max: PITCH_MAX },
        ] as const).map(({ key, label, min, max }) => (
          <label key={key} style={{ display: "block", marginBottom: 4 }}>
            <span style={{ display: "flex", justifyContent: "space-between", color: INK }}>
              <span>{label}</span>
              <span style={{ color: CHROME_GRAY, fontVariantNumeric: "tabular-nums" }}>{view[key]}°</span>
            </span>
            <input type="range" className="library-range" min={min} max={max} step={1} value={view[key]}
              onChange={(e) => place({ view: { ...view, [key]: Number(e.target.value) } })} />
          </label>
        ))}

        <p style={sectionTitle}>library {chosen.length} / {LIBRARY_SIZE}</p>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {Array.from({ length: LIBRARY_SIZE }, (_, i) => {
            const key = chosen[i];
            const c = key ? BY_KEY.get(key) : undefined;
            const life = LIFE_EVENTS[i];
            return (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, height: 30,
                borderBottom: `1px solid ${FAINT}`, background: key === focus ? "rgba(123, 123, 135, 0.08)" : "transparent" }}>
                <span style={{ width: 34, color: CHROME_GRAY, fontVariantNumeric: "tabular-nums" }}>{life.year}</span>
                {c ? (
                  <>
                    <button type="button" onClick={() => setFocus(c.key)} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1,
                      minWidth: 0, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: INK, font: "inherit", textAlign: "left" }}>
                      <Thumb key={c.key} shape={c} size={24} />
                      <span style={{ whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ color: CHROME_GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{life.event}</span>
                    </button>
                    <TextButton label="↑" disabled={i === 0} onClick={() => move(c.key, -1)} />
                    <TextButton label="↓" disabled={i === chosen.length - 1} onClick={() => move(c.key, 1)} />
                    <TextButton label="×" onClick={() => toggle(c.key)} />
                  </>
                ) : (
                  <span style={{ flex: 1, color: "rgba(123, 123, 135, 0.5)" }}>— {life.event}</span>
                )}
              </li>
            );
          })}
        </ol>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <TextButton label="save to library" disabled={chosen.length !== LIBRARY_SIZE || !unsaved} onClick={save}
            style={{ color: chosen.length === LIBRARY_SIZE && unsaved ? "#3f3f48" : undefined }} />
          {kept && <TextButton label="forget" onClick={forget} />}
          <Link to="/memory" style={{ color: CHROME_GRAY, fontSize: NOTE_SIZE, textDecoration: "none" }}>see the gallery →</Link>
        </div>
        <p style={{ margin: "6px 0 0", minHeight: 16, color: CHROME_GRAY }}>
          {note || (chosen.length !== LIBRARY_SIZE
            ? `choose ${LIBRARY_SIZE - chosen.length} more`
            : unsaved ? "not kept yet" : kept ? "kept on this machine" : "")}
        </p>

        {[{ title: `earlier · ${EARLIER_SHAPES.length}`, list: EARLIER_SHAPES }, { title: `Y series · ${Y_SERIES.length}`, list: Y_SERIES }].map(({ title, list }) => (
          <div key={title}>
            <p style={sectionTitle}>{title}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {list.map((c) => {
                const at = chosen.indexOf(c.key);
                return (
                  <div key={c.key} style={{ position: "relative" }}>
                    <button type="button" onClick={() => setFocus(c.key)} title={c.note}
                      style={{ width: "100%", padding: "4px 0 5px", border: `1px solid ${c.key === focus ? "rgba(111, 111, 122, 0.6)" : FAINT}`,
                        borderRadius: 3, background: at >= 0 ? "rgba(255, 255, 255, 0.75)" : "transparent", cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: INK, font: "inherit" }}>
                      <Thumb shape={c} size={52} />
                      <span>{c.name}</span>
                    </button>
                    <button type="button" aria-label={at >= 0 ? `remove ${c.name}` : `add ${c.name}`}
                      disabled={at < 0 && full} onClick={() => toggle(c.key)}
                      style={{ position: "absolute", top: 3, right: 3, minWidth: 18, height: 16, padding: "0 3px", border: "none",
                        borderRadius: 8, cursor: at < 0 && full ? "default" : "pointer", font: "inherit", fontSize: 10, lineHeight: "16px",
                        background: at >= 0 ? INK : "rgba(123, 123, 135, 0.12)", color: at >= 0 ? "#fff" : INK,
                        opacity: at < 0 && full ? 0.35 : 1 }}>
                      {at >= 0 ? at + 1 : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      <style>{`
        .library-range { -webkit-appearance: none; appearance: none; width: 100%; height: 18px; margin: 0; background: transparent; cursor: pointer; display: block; }
        .library-range::-webkit-slider-runnable-track { height: 1px; background: rgba(123, 123, 135, 0.4); }
        .library-range::-moz-range-track { height: 1px; background: rgba(123, 123, 135, 0.4); }
        .library-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 9px; height: 9px; border-radius: 50%; margin-top: -4px; background: #7b7b87; border: none; }
        .library-range::-moz-range-thumb { width: 9px; height: 9px; border-radius: 50%; background: #7b7b87; border: none; }
        .library-range:focus-visible { outline: none; }
      `}</style>
    </main>
  );
}
