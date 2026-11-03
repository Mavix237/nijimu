import { useEffect, useState } from "react";
import { LIFE_EVENTS } from "../data/memoryData";
import { MAP_ANCHORS } from "./memoryShape";
import { hashString, mulberry32 } from "./seededRandom";
import {
  CATEGORY_LABELS, createArtifactForm, formForMemory, formKey, isArtifactForm,
  type ArtifactCategory, type ArtifactForm,
} from "./superformula";

/*
 * The gallery's library: the fifteen shapes its curated memories wear, in
 * memory order (the first entry is the first memory, 2003), each with its
 * size in the seat and where the picture hangs inside it. It is chosen in
 * /lab/shapes from two sets — the sixteen the gallery drew before the Y
 * series (E-01 … E-16) and the eighteen Y shapes — and kept in localStorage
 * on this machine. With nothing kept the memories wear TUNED (the demo's
 * settling, 2026-10-12: softer forms, each with its own morph);
 * ORIGINAL_LIBRARY is BUILT_IN, the settling saved from /lab/shapes on 2026-10-11.
 */

/** One shape per curated memory (16 until 2026-11-03, when "Met someone through a screen", id 12, was removed). */
export const LIBRARY_SIZE = LIFE_EVENTS.length;

export interface ShapeCandidate {
  key: string;
  name: string;
  note: string;
  form: ArtifactForm;
  /** How far it has grown from its sphere. */
  morph: number;
}

export interface ShapePlacement {
  /** The vessel's size against the gallery's own framing. */
  size: number;
  /** How high on the wall the strip is hung, the sheet's anchorHeight (0.3 … 1). */
  photoHeight: number;
  /** How far round the wall from the usual side, in degrees. */
  photoAround: number;
  /** The strip's size against the size fitted to the cavity. */
  photoSize: number;
  /** Which of the gallery stills hangs inside, by its place in the sorted set. Absent keeps the memory's own still. */
  photo?: number;
  /** A kept camera: the seat opens here and does not drift on hover; a drag still turns it (in /lab/shapes it holds still). Null leaves the usual view. */
  view: ShapeView | null;
  /** This vessel's own look, over the gallery's tune (VESSEL_GALLERY_TUNE keys: glass, drape, dye, light…). Absent wears the gallery's. */
  tune?: Record<string, number>;
}

export interface ShapeView {
  /** Degrees round the form from the usual side. */
  around: number;
  /** The eye's height, degrees. */
  pitch: number;
}

export interface LibraryEntry extends ShapeCandidate, ShapePlacement {}

export const PLACEMENT_DEFAULT: ShapePlacement = { size: 1, photoHeight: 1, photoAround: 0, photoSize: 1, view: null };

/** How the gallery seated its curated memories before the Y series; the rest kept their seeded form. */
const EARLIER_SEATS: Record<string, { category: ArtifactCategory; draw?: number }> = {
  "0": { category: "sphere" },
  "2": { category: "roundedBox" },
  "3": { category: "cylinder" },
  "5": { category: "prism" },
  "7": { category: "diamond" },
  "8": { category: "flower" },
  "9": { category: "star", draw: 5 },
  "11": { category: "gear", draw: 2 },
  "13": { category: "hybrid" },
  "15": { category: "torn" },
};

function earlierCandidate(index: number): ShapeCandidate {
  const e = LIFE_EVENTS[index];
  // named for the memory's id, not its place, so a memory removed from the list leaves the others' names as they were
  const name = `E-${String(Number(e.id) + 1).padStart(2, "0")}`;
  const seat = EARLIER_SEATS[e.id];
  if (seat) {
    const seed = seat.draw === undefined ? `vessel|${e.id}` : `vessel|${seat.category}|${seat.draw}`;
    const form = createArtifactForm({ seed, category: seat.category });
    return { key: name, name, note: `${e.year} · ${CATEGORY_LABELS[form.category]}`, form, morph: 0.6 };
  }
  // the archive's seeded growth: the third draw of the memory's own generator
  const rand = mulberry32(hashString(`shape|${e.id}|${e.year}|${e.event}`));
  rand();
  rand();
  const form = formForMemory(e.id);
  return { key: name, name, note: `${e.year} · ${CATEGORY_LABELS[form.category]}`, form, morph: rand() * 0.5 + 0.5 };
}

const cloneForm = (form: ArtifactForm): ArtifactForm => ({
  category: form.category,
  top: { ...form.top },
  side: { ...form.side },
  ...(form.hybridOf ? { hybridOf: [form.hybridOf[0], form.hybridOf[1]] } : {}),
  ...(form.proportion ? { proportion: { ...form.proportion } } : {}),
});

export const EARLIER_SHAPES: ShapeCandidate[] = LIFE_EVENTS.map((_, i) => earlierCandidate(i));
export const Y_SERIES: ShapeCandidate[] = MAP_ANCHORS.map((a) => ({
  key: a.id, name: a.id, note: CATEGORY_LABELS[a.form.category], form: cloneForm(a.form), morph: 1,
}));
export const SHAPE_CANDIDATES: ShapeCandidate[] = [...EARLIER_SHAPES, ...Y_SERIES];

export const libraryEntry = (c: ShapeCandidate, p: ShapePlacement = PLACEMENT_DEFAULT): LibraryEntry => ({
  key: c.key, name: c.name, note: c.note, form: cloneForm(c.form), morph: c.morph,
  size: p.size, photoHeight: p.photoHeight, photoAround: p.photoAround, photoSize: p.photoSize,
  ...(typeof p.photo === "number" ? { photo: p.photo } : {}),
  view: p.view ? { around: p.view.around, pitch: p.view.pitch } : null,
  ...(p.tune && Object.keys(p.tune).length ? { tune: { ...p.tune } } : {}),
});

/** The gallery's built-in fifteen, in memory order (2003 first). A library kept in the browser still wins over it. */
const BUILT_IN: { key: string; place: ShapePlacement }[] = [
  { key: "Y-01", place: { size: 1, photoHeight: 1, photoAround: -41, photoSize: 1.13, view: { around: -45, pitch: -18 } } },
  { key: "Y-09", place: { size: 0.94, photoHeight: 0.68, photoAround: 42, photoSize: 1.22, view: { around: 43, pitch: -9 } } },
  { key: "E-08", place: { size: 1.37, photoHeight: 1, photoAround: 0, photoSize: 1.05, view: { around: 7, pitch: -10 } } },
  { key: "E-10", place: { size: 1.17, photoHeight: 1, photoAround: -26, photoSize: 1.13, view: { around: -39, pitch: -32 } } },
  { key: "Y-03", place: { size: 1.2, photoHeight: 1, photoAround: 29, photoSize: 1.33, view: { around: 19, pitch: -35 } } },
  { key: "Y-04", place: { size: 1.39, photoHeight: 0.8, photoAround: -18, photoSize: 1.1, view: { around: 2, pitch: 1 } } },
  { key: "Y-17", place: { size: 1.2, photoHeight: 1, photoAround: 0, photoSize: 1, view: { around: -9, pitch: 4 } } },
  { key: "Y-20", place: { size: 1.22, photoHeight: 0.85, photoAround: -48, photoSize: 1.15, view: { around: -3, pitch: -35 } } },
  { key: "Y-06", place: { size: 1.29, photoHeight: 1, photoAround: 47, photoSize: 0.93, view: { around: 6, pitch: 1 } } },
  { key: "Y-07", place: { size: 1.5, photoHeight: 1, photoAround: 0, photoSize: 1, view: { around: 0, pitch: 4 } } },
  { key: "Y-08", place: { size: 0.9, photoHeight: 0.9, photoAround: 1, photoSize: 1.32, view: { around: -23, pitch: -35 } } },
  { key: "E-14", place: { size: 1.16, photoHeight: 0.9, photoAround: -1, photoSize: 0.92, view: { around: -33, pitch: -31 } } },
  { key: "E-02", place: { size: 1.32, photoHeight: 1, photoAround: -2, photoSize: 1.03, view: { around: 0, pitch: 4 } } },
  { key: "Y-12", place: { size: 1.3, photoHeight: 1, photoAround: 0, photoSize: 1, view: null } },
  { key: "Y-13", place: { size: 0.79, photoHeight: 1, photoAround: 0, photoSize: 1, view: { around: -5, pitch: -17 } } },
];

/** The settling saved from /lab/shapes on 2026-10-11, before the demo's tuning. Kept to go back to. */
export const ORIGINAL_LIBRARY: LibraryEntry[] = BUILT_IN.map(({ key, place }) => {
  const c = SHAPE_CANDIDATES.find((s) => s.key === key);
  if (!c) throw new Error(`gallery library: no shape ${key}`);
  return libraryEntry(c, place);
});

type Tuned = Pick<LibraryEntry, "key" | "form" | "morph"> & ShapePlacement;

/** The demo's settling, tuned form by form in /lab/shapes on 2026-10-12 (softer forms). Every visitor's default (brought from the demo branch, 2026-11-02). */
const TUNED: Tuned[] = [
  // 2003 · tuned in /studio 2026-11-02: top m 8 → 10.7, morph .56 → .52 (strip kept at the size it had: 1.13 of the old fit)
  { key: "Y-01", morph: 0.52, size: 1, photoHeight: 1, photoAround: -41, photoSize: 1.08, photo: 0, view: { around: -45, pitch: -18 },
    form: { category: "hybrid", top: { m: 10.7, n1: 1.715, n2: 6.018, n3: 1.33, a: 1.2, b: 0.5 }, side: { m: 0, n1: 0.117, n2: 3.214, n3: 0.117, a: 1.25, b: 1.05 } } },
  // 2009 · tuned in /studio 2026-11-02: a new form, the picture lower and further round, the strip larger
  { key: "Y-09", morph: 0.31, size: 0.94, photoHeight: 0.95, photoAround: 61, photoSize: 1.214, photo: 0, view: { around: 62, pitch: -9 },
    form: { category: "hybrid", top: { m: 7.2, n1: 0.28, n2: 0.65, n3: 0.65, a: 1.3, b: 1 }, side: { m: 4, n1: 3.77, n2: 3.77, n3: 3.77, a: 1, b: 1 }, proportion: { radial: 1, vertical: 1.12 } },
    tune: { inset: 0.915 } },
  // 2012 · tuned in /studio 2026-11-02: top m 4 → 7.4 (strip kept at the size it had: 1.05 of the old fit)
  { key: "E-08", morph: 0.6, size: 1.37, photoHeight: 1, photoAround: 0, photoSize: 1.046, photo: 1, view: { around: 7, pitch: -10 },
    form: { category: "diamond", top: { m: 7.4, n1: 0.956, n2: 0.956, n3: 0.956 }, side: { m: 4, n1: 0.899, n2: 0.899, n3: 0.899 } } },
  // 2016 · tuned in /studio 2026-11-02: top m 7 → 6.85, morph .42 → .31 (strip kept at the size it had: 1.13 of the old fit)
  { key: "E-10", morph: 0.31, size: 1.17, photoHeight: 1, photoAround: -26, photoSize: 1.328, photo: 2, view: { around: -39, pitch: -32 },
    form: { category: "star", top: { m: 6.85, n1: 0.404, n2: 0.385, n3: 0.385 }, side: { m: 0.846, n1: 0.391, n2: 0.746, n3: 0.746 } } },
  // 2017 · tuned in /studio 2026-11-02: top m 10 → 13.4, vertical 1.07, morph .46 → .5, the strip smaller (2.51 → 1.8)
  // the view turned 2026-11-03 (−10° / −35° from the picture's side → 11° / 20.5°)
  { key: "Y-03", morph: 0.5, size: 1.2, photoHeight: 1, photoAround: 29, photoSize: 0.944, photo: 0, view: { around: 40, pitch: 20.5 },
    form: { category: "hybrid", top: { m: 13.4, n1: 1.621, n2: 1.227, n3: 1.089, a: 1.55, b: 0.95 }, side: { m: 3.95, n1: 1.17, n2: 0.793, n3: 2.144, a: 1, b: 1 }, proportion: { radial: 1, vertical: 1.07 } } },
  // 2020 · tuned in /studio 2026-11-03: the picture higher (.8 → 1), the strip smaller (2.68 → 2.38) and tilted 7, the view turned
  { key: "Y-04", morph: 0.71, size: 1.39, photoHeight: 1, photoAround: -18, photoSize: 0.975, photo: 3, view: { around: -19, pitch: -10 },
    form: { category: "hybrid", top: { m: 8, n1: 1.037, n2: 1.037, n3: 1.037, a: 1, b: 1 }, side: { m: 4.3, n1: 1.037, n2: 1.037, n3: 1.037, a: 1, b: 1 } },
    tune: { tilt: 7 } },
  // 2021 · tuned in /studio 2026-11-02: a new urchin, morph .42 → .21 (strip kept at the size it had: 1 of the old fit)
  { key: "Y-17", morph: 0.21, size: 1.2, photoHeight: 1, photoAround: 0, photoSize: 1.112, photo: 0, view: { around: -9, pitch: 4 },
    form: { category: "urchin", top: { m: 8.1, n1: 0.497, n2: 0.497, n3: 0.497, a: 1, b: 1 }, side: { m: 11, n1: 0.537, n2: 0.537, n3: 0.537, a: 1, b: 1 } } },
  // 07 · First Sense of Beauty (2025) · tuned in /studio 2026-11-03: top m 0 → 7.45 (strip kept at the size it had: 1.15 of the old fit)
  { key: "Y-20", morph: 0.35, size: 1.22, photoHeight: 0.85, photoAround: -48, photoSize: 1.314, photo: 4, view: { around: -27, pitch: -33.5 }, // view turned 2026-11-03 (45° / −35° → 21° / −33.5° from the picture)
    form: { category: "flower", top: { m: 7.45, n1: 0.567, n2: 1.766, n3: 1.046, a: 1.1, b: 1 }, side: { m: 0, n1: 1.013, n2: 1.847, n3: 1.847, a: 1, b: 1 } } },
  // 2022 · tuned in /studio 2026-11-03: top m 8 → 11.2, n1 15.08 → 19.05, b .55 → .5, vertical 1.12, strip 1.72
  { key: "Y-06", morph: 0.56, size: 1.29, photoHeight: 1, photoAround: 47, photoSize: 0.829, photo: 5, view: { around: 6, pitch: 1 },
    form: { category: "hybrid", top: { m: 11.2, n1: 19.05, n2: 5.474, n3: 7.849, a: 1.35, b: 0.5 }, side: { m: 7.8, n1: 1.554, n2: 0.265, n3: 0.695, a: 1.3, b: 0.7 }, proportion: { radial: 1, vertical: 1.12 } } },
  // 2023 · tuned in /studio 2026-11-03: a new form (strip kept at the size it had: 1 of the old fit)
  { key: "Y-07", morph: 0.55, size: 1.5, photoHeight: 1, photoAround: 0, photoSize: 1.018, photo: 6, view: { around: 0, pitch: 4 },
    form: { category: "hybrid", top: { m: 9.6, n1: 12.08, n2: 4.01, n3: 1.93, a: 0.95, b: 1 }, side: { m: 3.8, n1: 0.93, n2: 1.02, n3: 1.01, a: 1, b: 1 } } },
  // 2024 · tuned in /studio 2026-11-03: top m 16 → 16.8, radial .95 / vertical 1.04, morph .6 → .41, the view turned
  // (strip kept at the size it had: 1.32 of the old fit)
  { key: "Y-08", morph: 0.41, size: 0.92, photoHeight: 0.9, photoAround: 1, photoSize: 1.171, photo: 0, view: { around: -14, pitch: -24.5 },
    form: { category: "hybrid", top: { m: 16.8, n1: 12.806, n2: 5.045, n3: 2.995, a: 1.45, b: 0.75 }, side: { m: 2.6, n1: 0.858, n2: 0.179, n3: 0.858, a: 0.85, b: 1.25 }, proportion: { radial: 0.95, vertical: 1.04 } } },
  // 2024 · My first audiovisual performance, tuned in /studio 2026-11-03: a diamond, morph .45, the picture a little lower,
  // the strip larger (2.47 → 2.76) and its own: inset, a deeper tear, a wider edge fade, small perforations, hung flatter
  { key: "E-14", morph: 0.45, size: 1.1, photoHeight: 0.96, photoAround: -1, photoSize: 1.302, photo: 7, view: { around: 14, pitch: -3 },
    form: { category: "diamond", top: { m: 4, n1: 1.026, n2: 1.026, n3: 1.026, a: 1, b: 1 }, side: { m: 4, n1: 0.878, n2: 0.878, n3: 0.878, a: 1, b: 1 } },
    tune: { inset: 0.865, tornDepth: 3.2, edgeFade: 5, holeSize: 0.2, tilt: 0, contact: 29.5, sag: 17, peel: 10, gap: 0, flowSheer: 0.24 } },
  { key: "E-02", morph: 0.67, size: 1.32, photoHeight: 1, photoAround: -2, photoSize: 1.03, photo: 8, view: { around: 0, pitch: 4 },
    form: { category: "hybrid", top: { m: 6, n1: 0.198, n2: 1.714, n3: 1.714 }, side: { m: 0, n1: 1.01, n2: 1.01, n3: 1.01 }, hybridOf: ["flower", "sphere"] } },
  // 2025 · tuned in /studio 2026-11-03: top m 20.9 → 13.65, n1 3.24 → 6.09, n2 4.44 → 3.11, morph .46 → .37, a kept view
  // (strip kept at the size it had: 1 of the old fit)
  { key: "Y-12", morph: 0.37, size: 1.19, photoHeight: 1, photoAround: 0, photoSize: 0.813, photo: 0, view: { around: 18, pitch: 17.5 },
    form: { category: "hybrid", top: { m: 13.65, n1: 6.09, n2: 3.11, n3: 1.488, a: 1.2, b: 0.5 }, side: { m: 20.3, n1: 1.071, n2: 1.238, n3: 5.78, a: 1.5, b: 0.65 } } },
  // 2026 · tuned in /studio 2026-11-03: a gear, morph .25 → .3, the picture 144° round, the strip larger (.73 → 1), the view from its side
  { key: "Y-13", morph: 0.3, size: 1.34, photoHeight: 1, photoAround: 144, photoSize: 0.964, photo: 9, view: { around: 125, pitch: -17 },
    form: { category: "gear", top: { m: 4.8, n1: 1.15, n2: 6.09, n3: 10.1, a: 0.9, b: 1 }, side: { m: 4, n1: 10, n2: 10, n3: 10, a: 1, b: 1 }, proportion: { radial: 1, vertical: 1.2 } } },
];

const TUNED_LIBRARY: LibraryEntry[] = TUNED.map(({ key, form, morph, ...place }) => {
  const c = SHAPE_CANDIDATES.find((s) => s.key === key);
  if (!c) throw new Error(`gallery library: no shape ${key}`);
  return libraryEntry({ ...c, form, morph }, place);
});

const DEFAULT_LIBRARY = TUNED_LIBRARY;

/** What the built glass and its sheet depend on; the size is not among them. */
export const entrySignature = (e: LibraryEntry) =>
  `${e.key}|${formKey(e.form)}|${e.morph}|${e.photoHeight}|${e.photoAround}|${e.photoSize}${e.tune ? `|${JSON.stringify(e.tune)}` : ""}`;

const KEY = "nijimu.gallery.library";
const EVENT = "nijimu-gallery-library";

const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function entryOf(value: unknown): LibraryEntry | null {
  const e = value as Partial<LibraryEntry> | null;
  if (!e || typeof e !== "object" || typeof e.key !== "string" || !isArtifactForm(e.form)) return null;
  if (!finite(e.morph, 0, 1) || !finite(e.size, 0.2, 3) || !finite(e.photoHeight, 0, 1.2)
    || !finite(e.photoAround, -360, 360) || !finite(e.photoSize, 0.2, 3)) return null;
  const v = e.view as Partial<ShapeView> | null | undefined;
  const view = v && finite(v.around, -360, 360) && finite(v.pitch, -90, 90) ? { around: v.around, pitch: v.pitch } : null;
  const photo = finite(e.photo, 0, 15) ? Math.round(e.photo) : undefined;
  const tune = e.tune && typeof e.tune === "object"
    ? Object.fromEntries(Object.entries(e.tune).filter(([, v]) => typeof v === "number" && Number.isFinite(v)))
    : {};
  return {
    key: e.key, name: typeof e.name === "string" ? e.name : e.key, note: typeof e.note === "string" ? e.note : "",
    form: e.form, morph: e.morph, size: e.size, photoHeight: e.photoHeight, photoAround: e.photoAround, photoSize: e.photoSize,
    ...(photo === undefined ? {} : { photo }), view,
    ...(Object.keys(tune).length ? { tune } : {}),
  };
}

function readKept(): { entries: LibraryEntry[]; at: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { entries?: unknown; at?: unknown } | null;
    if (!raw || !Array.isArray(raw.entries) || raw.entries.length !== LIBRARY_SIZE) return null;
    const entries = raw.entries.map(entryOf);
    if (!entries.every((e): e is LibraryEntry => e !== null)) return null;
    return { entries, at: typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : 0 };
  } catch {
    return null;
  }
}

/** The kept library, or null when none is kept (or it cannot be read). */
export function loadGalleryLibrary(): LibraryEntry[] | null {
  return readKept()?.entries ?? null;
}

let version = 0;
let memo: { version: number; entries: LibraryEntry[]; at: number } | null = null;
const bump = () => { version++; window.dispatchEvent(new Event(EVENT)); };

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) bump(); });
}

export function saveGalleryLibrary(entries: LibraryEntry[]) {
  if (entries.length !== LIBRARY_SIZE) throw new Error(`the library holds ${LIBRARY_SIZE} shapes`);
  localStorage.setItem(KEY, JSON.stringify({ entries, at: Date.now() }));
  bump();
}

export function forgetGalleryLibrary() {
  localStorage.removeItem(KEY);
  bump();
}

/** Bumps whenever the library is saved or forgotten, here or in another tab. */
export const libraryVersion = () => version;

/** The fifteen shapes the curated memories wear: the kept library, else the built-in settling. */
export function galleryLibrary(): LibraryEntry[] {
  return current().entries;
}

/** When the library was kept (ms); 0 for the built-in Y series. A gallery edit pushed later still wins over it. */
export function librarySavedAt(): number {
  return current().at;
}

function current() {
  if (memo?.version === version) return memo;
  const kept = readKept();
  memo = { version, entries: kept?.entries ?? DEFAULT_LIBRARY, at: kept?.at ?? 0 };
  return memo;
}

/** A curated memory's library shape, by its id ("0" … "15"); null for any other memory. */
export function curatedShape(id: string): LibraryEntry | null {
  if (!/^\d+$/.test(id)) return null;
  return galleryLibrary()[Number(id)] ?? null;
}

/** The library and its version, re-rendering when it changes. */
export function useGalleryLibrary() {
  const [seen, setSeen] = useState(version);
  useEffect(() => {
    const on = () => setSeen(version);
    window.addEventListener(EVENT, on);
    on();
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return { entries: galleryLibrary(), version: seen };
}
