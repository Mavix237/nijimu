import { useEffect, useState } from "react";
import { LIFE_EVENTS } from "../data/memoryData";
import { MAP_ANCHORS } from "./memoryShape";
import { hashString, mulberry32 } from "./seededRandom";
import {
  CATEGORY_LABELS, createArtifactForm, formForMemory, formKey, isArtifactForm,
  type ArtifactCategory, type ArtifactForm,
} from "./superformula";

/*
 * The gallery's library: the sixteen shapes its curated memories wear, in
 * memory order (the first entry is the first memory, 2003), each with its
 * size in the seat and where the picture hangs inside it. It is chosen in
 * /lab/shapes from two sets — the sixteen the gallery drew before the Y
 * series (E-01 … E-16) and the eighteen Y shapes — and kept in localStorage
 * on this machine. With nothing kept the memories wear BUILT_IN, the settling
 * saved from /lab/shapes on 2026-10-11.
 */

export const LIBRARY_SIZE = 16;

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
  /** A locked camera: the seat opens here and a drag does not turn it. Null leaves the usual view, free to turn. */
  view: ShapeView | null;
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
  const name = `E-${String(index + 1).padStart(2, "0")}`;
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
});

/** The gallery's built-in sixteen, in memory order (2003 first). A library kept in the browser still wins over it. */
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
  { key: "Y-16", place: { size: 1.05, photoHeight: 1, photoAround: 0, photoSize: 1, view: { around: 10, pitch: 25 } } },
  { key: "E-02", place: { size: 1.32, photoHeight: 1, photoAround: -2, photoSize: 1.03, view: { around: 0, pitch: 4 } } },
  { key: "Y-12", place: { size: 1.3, photoHeight: 1, photoAround: 0, photoSize: 1, view: null } },
  { key: "Y-13", place: { size: 0.79, photoHeight: 1, photoAround: 0, photoSize: 1, view: { around: -5, pitch: -17 } } },
];

const DEFAULT_LIBRARY: LibraryEntry[] = BUILT_IN.map(({ key, place }) => {
  const c = SHAPE_CANDIDATES.find((s) => s.key === key);
  if (!c) throw new Error(`gallery library: no shape ${key}`);
  return libraryEntry(c, place);
});

/** What the built glass and its sheet depend on; the size is not among them. */
export const entrySignature = (e: LibraryEntry) =>
  `${e.key}|${formKey(e.form)}|${e.morph}|${e.photoHeight}|${e.photoAround}|${e.photoSize}`;

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
  return {
    key: e.key, name: typeof e.name === "string" ? e.name : e.key, note: typeof e.note === "string" ? e.note : "",
    form: e.form, morph: e.morph, size: e.size, photoHeight: e.photoHeight, photoAround: e.photoAround, photoSize: e.photoSize,
    ...(photo === undefined ? {} : { photo }), view,
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

/** The sixteen shapes the curated memories wear: the kept library, else the built-in settling. */
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
