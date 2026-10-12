import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { memoryColorOf, vesselTint } from "../lib/vesselTint";
import { MemoryCarouselPage } from "../components/MemoryCarouselPage";
import { LIFE_EVENTS } from "../data/memoryData";
import { CHROME_GRAY, COLOR_PALETTE } from "../lib/colors";
import { buildArchive, type ArchiveArtifact } from "../lib/archive";
import { carouselContainsOffset, portraitTall } from "../lib/carouselLayout";
import {
  GalleryOverrideContext, type ArtifactSeat, type GalleryOverride, type SeatDepth, type SeatPlace,
} from "../lib/galleryOverride";
import { pushGalleryPanel, readGalleryPush, useGalleryPush, type GalleryPanel, type GalleryPanelPush } from "../lib/labPush";
import { entrySignature, galleryLibrary, librarySavedAt, libraryVersion, setLibraryMode, useGalleryLibrary, type LibraryEntry } from "../lib/galleryLibrary";
import { formKey } from "../lib/superformula";
import {
  DISTANCE_FADE, VESSEL_TUNE_DEFAULT, VesselPreview, buildGlass, fitSheetSize, smooth01,
  type Room, type VesselState, type VesselTune,
} from "./VesselPreview";
import { VesselArtifact, loadSeatPhoto, preloadSeatPhotos, vesselCanvasScale } from "./VesselArtifact";
import { vesselParts } from "./vesselBuilds";
import { HEADER_MENU_ORDER, HeaderMenuRow, useHeaderMenu } from "../components/HeaderMenu";
import { MemoryReadingPane, type ReadableMemory } from "../components/MemoryReadingPane";
import { useCompact } from "../hooks/useCompact";
import { LabPushButton } from "./LabPushButton";
import { HEADER_ICON_LABEL_PAD, HeaderIconLabel } from "../components/HeaderIconLabel";
import {
  DOLLY_IN, DOLLY_MAX, DOLLY_MIN, FIELD_FOCAL, blendSeat, easeFlight, memoryFieldPlace, fieldSeat, surfacingSeat,
  type FieldCamera,
} from "./vesselField";
import photoA from "../../assets/memory-photo.jpg";
import photoB from "../../assets/memory-photo-02.jpg";

/*
 * Lab: the dive gallery with the vessel on every seat. The gallery itself —
 * its S-curve, caption, timescale, wheel and keys, the way out to the pond —
 * is the live one (MemoryCarouselPage, untouched); through GalleryOverride it
 * is handed ten memories and asked to draw each as the glass vessel from
 * /lab/vessel with a photo inside, the draped sheet under the refraction
 * look, sized to its own cavity, the picture on the glass side of the sheet
 * and facing the viewer, who turns the vessel by dragging it. Each curated
 * memory wears its shape from the gallery library (lib/galleryLibrary, chosen
 * in /lab/shapes) at the size and with the picture placed as kept there; the
 * photos are src/assets/vessel-gallery, in name order (drop ten in; the
 * bundled stills stand in for any missing).
 *
 * Pressing the vessel at the apex opens it in the lab as an editor for that
 * one memory — its form, glass, sheet, dye, light and photo — and "back to
 * the gallery" returns with the memory drawn as it was left. The side panel
 * is the only thing push sends: those knobs, for the memory that is open.
 * The memories page already draws this gallery; it reads the same knobs, and
 * the lab opens on whatever that page is using. The photo is chosen under
 * the form, so a push leaves it where it is.
 *
 * A second view, the field (the switch at the top right): the same ten hang
 * in the air by distance rather than along the years — near and large, far
 * and small and hazed — the eye looking round them with the pointer and into
 * them with the wheel. The seats fly between the two views along arcs, the
 * outer ones leaving first and the picked one coming home first; a press on
 * a memory in the field gathers the years back around it. The layout and the
 * flight are vesselField.ts; the clock, the camera and each seat's share are
 * kept here and handed to the gallery through adjustSeat every frame.
 */

export const PHOTOS = Object.entries(
  import.meta.glob("../../assets/vessel-gallery/*.{jpg,jpeg,png,webp}", { eager: true, import: "default" }) as Record<string, string>,
).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
const FALLBACK = [photoA, photoB];
// fetched and decoded once the page is idle — after the landing's first paint, not competing with
// its fonts and script — so the seats still open with their pictures already in the stock
const preloadWhenIdle = () => preloadSeatPhotos(PHOTOS.length ? PHOTOS : FALLBACK);
if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preloadWhenIdle, { timeout: 2500 });
else setTimeout(preloadWhenIdle, 1200);

/** Which of the curated memories the lab seats; these are the ones with a photo. */
const SEATS: { event: number }[] = [
  { event: 0 },
  { event: 2 },
  { event: 3 },
  { event: 5 },
  { event: 7 },
  { event: 8 },
  { event: 9 },
  { event: 11 },
  { event: 13 },
  { event: 15 },
];

/**
 * The lab's settling, with the film's edge quieter: smaller, fainter
 * perforations, less rim. No slow turn — the vessel opens with its picture
 * squarely to the viewer and would turn it away; the viewer turns it by hand.
 */
export const VESSEL_GALLERY_TUNE: VesselTune = {
  ...VESSEL_TUNE_DEFAULT,
  ...DISTANCE_FADE,
  morph: 0.6,
  holeSize: 0.6, holeWidth: 0.75, holeFade: 0.75, holeRim: 0.25,
  mono: 0, negative: 0,
  pitch: 4, turn: 0, ground: 0,
};

/**
 * The room the glass reflects and shows through where nothing is behind it.
 * The lab's grey wall (#b3b3b3) sat in a grey backdrop; over the gallery's
 * pale water it read as a dark cast on every vessel, so here the room is the
 * water's own light.
 */
export const VESSEL_GALLERY_ROOM: Room = { above: "#e6e7ea", below: "#ffffff" };

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return 1 + (h % 97) / 10;
}

const wrapDegrees = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Where this memory's still sits in the gallery set. A memory that was never seated wears the first still, as the shapes lab does. */
export function slotPhotoIndex(index: number): number {
  const seat = SEATS.findIndex((s) => s.event === index);
  return seat < 0 ? 0 : seat;
}

/** The picture inside a curated memory: a library pick, else the still the shapes lab shows for that place. */
export function memoryPhoto(index: number, picked?: number): string {
  const i = picked !== undefined && PHOTOS[picked] ? picked : slotPhotoIndex(index);
  return PHOTOS[i] ?? FALLBACK[i % FALLBACK.length];
}

/** The photo a curated memory carries in the gallery, by its place in LIFE_EVENTS. */
export function curatedPhoto(index: number): string {
  return memoryPhoto(index);
}

/** A curated memory's vessel wearing a library shape: its form and growth, its size, and where its picture hangs. */
export function libraryVessel(index: number, entry: LibraryEntry, url = memoryPhoto(index, entry.photo)): VesselState {
  const e = LIFE_EVENTS[index];
  const glass = buildGlass(entry.form, entry.morph);
  const sheetSize = fitSheetSize(glass) * entry.photoSize;
  glass.geometry.dispose();
  const tune = {
    ...VESSEL_GALLERY_TUNE, ...vesselTint(e.feeling), morph: entry.morph, sheetSize,
    anchorHeight: entry.photoHeight, anchorAngle: wrapDegrees(VESSEL_GALLERY_TUNE.anchorAngle + entry.photoAround),
  };
  return {
    tune, mode: "refract", sheetMode: "draped", face: "glass", room: VESSEL_GALLERY_ROOM,
    url, seed: seedOf(e.id), form: entry.form, size: entry.size,
    facing: wrapDegrees(VESSEL_GALLERY_TUNE.anchorAngle + (entry.view?.around ?? 0)),
    viewPitch: entry.view?.pitch ?? VESSEL_GALLERY_TUNE.pitch,
    viewLocked: !!entry.view,
  };
}

let curatedMemo: { version: number; states: VesselState[] } | null = null;
/** Every curated memory's vessel as the library has it, in LIFE_EVENTS order. */
function curatedStates(): VesselState[] {
  const version = libraryVersion();
  if (curatedMemo?.version === version) return curatedMemo.states;
  const library = galleryLibrary();
  const states = LIFE_EVENTS.map((_, i) => libraryVessel(i, library[i]));
  curatedMemo = { version, states };
  return states;
}
/** The lab's seat i as the library has it. */
const seatBase = (i: number) => curatedStates()[SEATS[i].event];
const curatedIndex = (id: string) => LIFE_EVENTS.findIndex((e) => e.id === id);

/** A pushed panel over a library vessel. Pushed after the library was kept, the panel is all of it;
    before, it is the look only, and the shape, size and picture place stay the library's. */
function overCurated(base: VesselState, panel: GalleryPanel | undefined, pushedAt: number): VesselState {
  if (!panel) return base;
  const state = withPanel(base, panel);
  if (pushedAt > librarySavedAt()) return { ...state, facing: undefined, viewPitch: undefined, viewLocked: undefined };
  const { morph, sheetSize, anchorHeight, anchorAngle } = base.tune;
  return { ...state, form: base.form, size: base.size, tune: { ...state.tune, morph, sheetSize, anchorHeight, anchorAngle } };
}

/**
 * The seats on the near side of the apex, drawn back. The curve's perspective
 * makes the first newer neighbour larger than the apex and lays it over it
 * (nearer seats draw on top), and the vessel fills its seat where the crystal
 * did not — so the one being looked at was half covered. From the apex out
 * the newer seats shrink (22% by the first neighbour, 28% by the second) and
 * move out toward the lower right (.045w/.025h at the first, .09w/.1h at the
 * second, so the first keeps clear of the apex and the second stays mostly
 * off the frame); and the apex draws over its neighbours, the order falling
 * off smoothly so a step never swaps two seats while they overlap.
 */
/** A wider canvas for a form whose points would otherwise leave the seat. The body stays put; the extra is the room the points need. */
function withCanvasRoom(seat: SeatPlace, room: number): SeatPlace {
  if (Math.abs(room - 1) < 0.001) return seat;
  return { ...seat, scale: seat.scale * room, size: seat.size * room, blurPx: seat.blurPx / room };
}

function adjustCurveSeat(depth: SeatDepth, offset: number, viewport: { w: number; h: number }): SeatPlace {
  const order = Math.round(offset * 100 + 140 * Math.max(0, 1 - Math.abs(offset) / 0.8));
  if (offset <= 0) return { ...depth, order };
  const w1 = smooth01(Math.min(offset, 1));
  const w2 = smooth01(Math.max(0, offset - 1));
  const shrink = 0.22 * w1 + 0.06 * w2;
  const scale = depth.scale * (1 - shrink);
  // an upright phone has height to spare and no width: the newer ones step
  // further down and out, so the one in hand stays clear
  const tall = portraitTall(viewport.w, viewport.h);
  return {
    ...depth,
    scale,
    size: depth.size * (1 - shrink),
    x: depth.x + viewport.w * (0.045 * w1 + 0.045 * w2 + 0.06 * w1 * tall),
    y: depth.y + viewport.h * (0.025 * w1 + 0.075 * w2 + (0.07 * w1 + 0.05 * w2) * tall),
    blurPx: depth.blurPx * (depth.scale / scale),
    order,
  };
}

/* ───────── the field's clock, camera and shares ───────── */

/** One seat's flight between the views. */
const FLIGHT_MS = 1500;
/** Between one seat's departure and the next ring's. */
const STAGGER_MS = 55;
const STAGGER_MAX = 6;
/** How far the eye looks round with the pointer, in fractions of the view. */
const PARALLAX_X = 0.03;
const PARALLAX_Y = 0.02;
/** A wheel's pixel into the field. */
const DOLLY_PER_PX = 0.001;

/** `?speed=0.2` slows the flight between the views, to judge it. */
const SPEED = Number(new URLSearchParams(window.location.search).get("speed")) || 1;

const variantOf = (i: number) => ((i * 7919) % 97) / 97;
const zeros = (n: number) => new Array<number>(n).fill(0);

class FieldDriver {
  count: number;
  on = false;
  direction: 1 | -1 = 1;
  share: number[];
  shareFrom: number[];
  delay: number[];
  hover: number[];
  whole = 0;
  wholeFrom = 0;
  startedAt = -1e9;
  cam: FieldCamera = { x: 0, y: 0, z: DOLLY_IN };
  camTarget = { x: 0, y: 0 };
  dolly = 0;
  dollyTarget = 0;
  hovered = -1;
  /** The seat at the apex, as the gallery last placed it. */
  apex = 0;
  busy = false;
  private cool = 0;
  private last = 0;

  constructor(count: number) {
    this.count = count;
    this.share = zeros(count);
    this.shareFrom = zeros(count);
    this.delay = zeros(count);
    this.hover = zeros(count);
  }

  /** The live gallery can hold more memories than the lab seated. Shares already in flight are kept. */
  resize(count: number) {
    if (count === this.count) return;
    const fit = (arr: number[]) => (count <= arr.length ? arr.slice(0, count) : arr.concat(zeros(count - arr.length)));
    this.share = fit(this.share);
    this.shareFrom = fit(this.shareFrom);
    this.delay = fit(this.delay);
    this.hover = fit(this.hover);
    this.count = count;
    if (this.apex >= count) this.apex = 0;
    if (this.hovered >= count) this.hovered = -1;
  }

  /** Send the seats to the field or back; `around` is the seat the stagger counts from. */
  set(on: boolean, around: number, now: number) {
    this.on = on;
    this.direction = on ? 1 : -1;
    this.startedAt = now;
    this.shareFrom = this.share.slice();
    this.wholeFrom = this.whole;
    for (let i = 0; i < this.count; i++) {
      const ring = Math.min(Math.abs(i - around), STAGGER_MAX);
      // leaving: the outer ones lift first and the one in hand last; coming home: the one in hand first
      this.delay[i] = (on ? STAGGER_MAX - ring : ring) * STAGGER_MS;
    }
    if (!on) { this.dollyTarget = 0; this.camTarget = { x: 0, y: 0 }; this.hovered = -1; }
    this.busy = true;
    this.last = now;
  }

  /** Advances to `now`; true while anything is still moving (and for two frames after, so the last place is drawn). */
  tick(now: number): boolean {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const t = (now - this.startedAt) * SPEED;
    const target = this.on ? 1 : 0;
    let moving = false;
    for (let i = 0; i < this.count; i++) {
      const p = easeFlight((t - this.delay[i]) / FLIGHT_MS);
      this.share[i] = this.shareFrom[i] + (target - this.shareFrom[i]) * p;
      if (p < 1) moving = true;
    }
    const pw = easeFlight(t / (FLIGHT_MS + STAGGER_MAX * STAGGER_MS));
    this.whole = this.wholeFrom + (target - this.wholeFrom) * pw;
    if (pw < 1) moving = true;
    const kCam = 1 - Math.exp(-3 * dt), kDolly = 1 - Math.exp(-4 * dt), kHover = 1 - Math.exp(-8 * dt);
    this.cam.x += (this.camTarget.x - this.cam.x) * kCam;
    this.cam.y += (this.camTarget.y - this.cam.y) * kCam;
    if (Math.abs(this.camTarget.x - this.cam.x) + Math.abs(this.camTarget.y - this.cam.y) > 2e-5) moving = true;
    this.dolly += (this.dollyTarget - this.dolly) * kDolly;
    if (Math.abs(this.dollyTarget - this.dolly) > 1e-4) moving = true;
    for (let i = 0; i < this.count; i++) {
      const h = i === this.hovered ? 1 : 0;
      this.hover[i] += (h - this.hover[i]) * kHover;
      if (Math.abs(h - this.hover[i]) > 1e-3) moving = true;
    }
    this.cam.z = this.dolly + DOLLY_IN * (1 - this.whole);
    if (moving) this.cool = 2;
    else if (this.cool > 0) this.cool--;
    this.busy = moving || this.cool > 0;
    return this.busy;
  }
}

/** The switch between the years and the field, beside the gallery's own chrome (the plus sits at right 114). */
function FieldToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [nameShown, setNameShown] = useState(false);
  const title = on ? "back along the years" : "see them in the air";
  const name = on ? "timeline" : "constellation";
  const { list } = useHeaderMenu();
  const glyph = (
    on ? (
      // the years: the curve with its seats along it
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M1.5 12.5 C 5 12.5, 6 3.5, 9.5 3.5 S 13 8, 14.5 8" stroke={CHROME_GRAY} strokeWidth="1.1" />
        <circle cx="3.2" cy="12.2" r="1.1" fill={CHROME_GRAY} />
        <circle cx="8" cy="6" r="1.5" fill={CHROME_GRAY} />
        <circle cx="13" cy="7.6" r="1.1" fill={CHROME_GRAY} />
      </svg>
    ) : (
      // the field: near and far
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="3.6" cy="4.2" r="2.1" stroke={CHROME_GRAY} strokeWidth="1.1" />
        <circle cx="12" cy="11.2" r="2.6" stroke={CHROME_GRAY} strokeWidth="1.1" />
        <circle cx="11.4" cy="3.6" r="1" fill={CHROME_GRAY} opacity="0.75" />
        <circle cx="6.8" cy="9.4" r="0.8" fill={CHROME_GRAY} opacity="0.6" />
        <circle cx="3.4" cy="12.6" r="1.2" fill={CHROME_GRAY} opacity="0.8" />
        <circle cx="8.6" cy="6.6" r="0.55" fill={CHROME_GRAY} opacity="0.5" />
      </svg>
    )
  );
  // folded into the header menu on a phone
  if (list) return <HeaderMenuRow order={HEADER_MENU_ORDER.field} icon={glyph} label={on ? "timeline view" : "constellation view"}
    ariaLabel={title} onClick={onToggle} />;
  return (
    <button
      type="button"
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onMouseEnter={() => setNameShown(true)}
      onMouseLeave={() => setNameShown(false)}
      onFocus={() => setNameShown(true)}
      onBlur={() => setNameShown(false)}
      style={{
        position: "fixed", top: "var(--chrome-top)", right: "var(--chrome-r2)", zIndex: 99999, boxSizing: "border-box",
        width: "var(--chrome-icon)", height: 36 + HEADER_ICON_LABEL_PAD, padding: `0 0 ${HEADER_ICON_LABEL_PAD}px`,
        border: "none", background: "transparent", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85,
      }}
    >
      <HeaderIconLabel name={name} shown={nameShown} />
      {glyph}
    </button>
  );
}

/** Shuffle between the tuned forms (the default) and the original ones, beside the field switch. */
function LibraryToggle() {
  const [nameShown, setNameShown] = useState(false);
  const { mode } = useGalleryLibrary();
  const { list } = useHeaderMenu();
  const tuned = mode === "tuned";
  const title = tuned ? "switch to the original forms" : "switch to the tuned forms";
  const flip = () => setLibraryMode(tuned ? "original" : "tuned");
  const glyph = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={CHROME_GRAY} strokeWidth="1.1"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.5 4.5h2.2c2.6 0 3.9 7 6.6 7h4.2" />
      <path d="M1.5 11.5h2.2c1.1 0 1.9-1.2 2.6-2.6M9 7.1c.6-1.4 1.4-2.6 2.6-2.6h2.9" />
      <path d="M12.8 2.6l1.7 1.9-1.7 1.9M12.8 9.6l1.7 1.9-1.7 1.9" />
      {!tuned && <circle cx="8" cy="14.6" r="0.9" fill={CHROME_GRAY} stroke="none" />}
    </svg>
  );
  if (list) return <HeaderMenuRow order={HEADER_MENU_ORDER.library} icon={glyph}
    label={tuned ? "original forms" : "tuned forms"} ariaLabel={title} onClick={flip} />;
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={!tuned}
      onClick={(e) => { e.stopPropagation(); flip(); }}
      onMouseEnter={() => setNameShown(true)}
      onMouseLeave={() => setNameShown(false)}
      onFocus={() => setNameShown(true)}
      onBlur={() => setNameShown(false)}
      style={{
        position: "fixed", top: "var(--chrome-top)", right: "var(--chrome-r3)", zIndex: 99999, boxSizing: "border-box",
        width: "var(--chrome-icon)", height: 36 + HEADER_ICON_LABEL_PAD, padding: `0 0 ${HEADER_ICON_LABEL_PAD}px`,
        border: "none", background: "transparent", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85,
      }}
    >
      <HeaderIconLabel name={tuned ? "tuned" : "original"} shown={nameShown} />
      {glyph}
    </button>
  );
}

/** The seat's vessel, skipped when nothing about it changed — the field re-renders the gallery every frame. */
const SeatVessel = memo(VesselArtifact);

/** A memory the lab did not seat, drawn as a vessel of the form it already has. */
function vesselForArchive(item: ArchiveArtifact): VesselState {
  const morph = Math.min(1, Math.max(0, item.shape.evolve));
  const form = item.shape.form;
  const glass = buildGlass(form, morph);
  const tune = { ...VESSEL_GALLERY_TUNE, ...vesselTint(item.look?.oklch), morph, haze: item.look?.vividness === undefined ? VESSEL_GALLERY_TUNE.haze : 1 - item.look.vividness, sheetSize: fitSheetSize(glass) };
  glass.geometry.dispose();
  const room = VESSEL_GALLERY_ROOM;
  return {
    tune, mode: "refract", sheetMode: "draped", face: "glass", room,
    url: item.look?.photoUrl ?? "", seed: seedOf(item.id), form,
  };
}

/** Same archive vessels for the distance step, including the user's pushed edits. */
export function galleryStateFor(item: ArchiveArtifact): VesselState {
  const i = curatedIndex(item.id);
  const push = readGalleryPush();
  const panel = push?.panels.find(row => row.id === item.id)?.panel;
  if (i >= 0) return overCurated(curatedStates()[i], panel, push?.at ?? 0);
  const base = vesselForArchive(item);
  return panel ? withPanel(base, panel) : base;
}

/**
 * Builds every gallery memory's glass and settled cloth into the shared cache
 * (vesselBuilds.ts) before the gallery is open — one memory per idle moment,
 * the middle of the archive first, where Enter lands. A phone's Enter then
 * finds its seats ready instead of settling cloth during the ink.
 */
export function warmGalleryVessels() {
  const items = buildArchive();
  const middle = (items.length - 1) / 2;
  const queue = items.slice().sort((a, b) => Math.abs(items.indexOf(a) - middle) - Math.abs(items.indexOf(b) - middle));
  const later = (run: () => void) => typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(run, { timeout: 2000 })
    : window.setTimeout(run, 60);
  const next = () => {
    const item = queue.shift();
    if (!item) return;
    const s = galleryStateFor(item);
    if (s.url) loadSeatPhoto(s.url).catch(() => undefined);
    vesselParts({ form: s.form, morph: s.tune.morph, tune: s.tune, sheetMode: s.sheetMode, seed: s.seed, sheetSize: s.tune.sheetSize });
    later(next);
  };
  later(next);
}

/** A stored tune, filled out with the gallery's where a key is missing. */
function tuneFromPush(raw: Record<string, number>): VesselTune {
  const tune = { ...VESSEL_GALLERY_TUNE };
  for (const key of Object.keys(tune) as (keyof VesselTune)[]) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) tune[key] = v;
  }
  return tune;
}

function seatId(i: number): string {
  return LIFE_EVENTS[SEATS[i].event].id;
}

/** The knobs on the right. The photo and the seed are not among them. */
function panelFromState(state: VesselState): GalleryPanel {
  return {
    tune: { ...state.tune },
    mode: state.mode,
    sheetMode: state.sheetMode,
    face: state.face,
    room: { above: state.room.above, below: state.room.below },
    form: state.form,
  };
}

/** The side panel laid over a vessel. Its picture stays the one it had. */
function withPanel(base: VesselState, panel: GalleryPanel): VesselState {
  return {
    ...base,
    // the look is the panel's; the colour stays the memory's
    tune: { ...tuneFromPush(panel.tune), ...memoryColorOf(base.tune) },
    mode: panel.mode,
    sheetMode: panel.sheetMode,
    face: panel.face,
    room: { above: panel.room.above, below: panel.room.below },
    form: panel.form,
  };
}

function panelEquals(state: VesselState, panel: GalleryPanel): boolean {
  return JSON.stringify(panelFromState(state)) === JSON.stringify(panelFromState(withPanel(state, panel)));
}

function draftsFromStore() {
  const push = readGalleryPush();
  return SEATS.map((_, i) => {
    const panel = push?.panels.find((row) => row.id === seatId(i))?.panel;
    return { state: overCurated(seatBase(i), panel, push?.at ?? 0), version: 0, echo: 0 };
  });
}

/**
 * The vessel gallery: the same seats, field and arrival the lab shows.
 * `items` replaces the archive (the lab's ten). Left out, the memories page
 * keeps every memory, and `resolve` says which vessel each one is.
 */
export function VesselGalleryProvider({
  active = true,
  items,
  resolve,
  cacheKeyFor,
  revision,
  onPick,
  onFocus,
  children,
}: {
  active?: boolean;
  items?: ArchiveArtifact[];
  resolve: (item: ArchiveArtifact) => VesselState;
  cacheKeyFor: (item: ArchiveArtifact) => string;
  /** Bumps when a vessel changes, so the gallery draws the new one. */
  revision: unknown;
  onPick?: (item: ArchiveArtifact) => void;
  onFocus?: (id: string) => void;
  children: ReactNode;
}) {
  const list = useMemo(() => items ?? buildArchive(), [items]);
  const driver = useRef<FieldDriver | null>(null);
  if (!driver.current) driver.current = new FieldDriver(list.length);
  const field = driver.current;
  field.resize(list.length);

  const [fieldOn, setFieldOn] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const run = useCallback(() => {
    if (rafRef.current || !activeRef.current) return;
    const tick = (now: number) => {
      if (!activeRef.current) { rafRef.current = 0; return; }
      const more = field.tick(now);
      setFrame((f) => f + 1);
      rafRef.current = more ? requestAnimationFrame(tick) : 0;
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [field]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => {
    if (active) run();
    else { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
  }, [active, run]);

  const setField = useCallback((on: boolean, around: number) => {
    field.set(on, around, performance.now());
    setFieldOn(on);
    setHoveredId(null);
    run();
  }, [field, run]);

  useEffect(() => {
    if (!fieldOn || !active) return;
    const move = (e: PointerEvent) => {
      field.camTarget = {
        x: ((e.clientX / window.innerWidth) * 2 - 1) * PARALLAX_X,
        y: ((e.clientY / window.innerHeight) * 2 - 1) * PARALLAX_Y,
      };
      run();
    };
    const wheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      field.dollyTarget = Math.min(DOLLY_MAX, Math.max(DOLLY_MIN, field.dollyTarget + e.deltaY * unit * DOLLY_PER_PX));
      run();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("wheel", wheel);
    };
  }, [fieldOn, active, field, run]);

  const indexOf = useCallback((item: ArchiveArtifact) => list.findIndex((it) => it.id === item.id), [list]);
  const listRef = useRef(list);
  listRef.current = list;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const keyRef = useRef(cacheKeyFor);
  keyRef.current = cacheKeyFor;
  const pickers = useRef(new Map<string, () => void>());

  const onFieldPick = useCallback((item: ArchiveArtifact) => {
    const i = indexOf(item);
    if (i < 0) return;
    field.apex = i;
    setField(false, i);
    focusRef.current?.(item.id);
  }, [indexOf, field, setField]);
  const onFieldHover = useCallback((id: string | null) => {
    field.hovered = id === null ? -1 : list.findIndex((it) => it.id === id);
    setHoveredId(id);
    run();
  }, [field, list, run]);

  const tunes = useRef(new Map<string, VesselTune>());
  const tuneFor = useCallback((item: ArchiveArtifact, haze: number) => {
    const own = resolveRef.current(item).tune;
    const h = 1 - (1 - own.haze) * (1 - haze);
    const q = Math.round(h * 100);
    if (q === Math.round(own.haze * 100)) return own;
    const key = `${keyRef.current(item)}|${q}`;
    let t = tunes.current.get(key);
    if (!t) {
      t = { ...own, haze: q / 100 };
      tunes.current.set(key, t);
    }
    return t;
  }, []);

  const renderArtifact = useCallback((item: ArchiveArtifact, seat: ArtifactSeat) => {
    const s = resolveRef.current(item);
    let pick = pickers.current.get(item.id);
    if (!pick) {
      const id = item.id;
      pick = () => {
        const found = listRef.current.find((it) => it.id === id);
        if (found) pickRef.current?.(found);
      };
      pickers.current.set(item.id, pick);
    }
    return (
      <SeatVessel
        cacheKey={keyRef.current(item)}
        priority={Math.round(Math.abs(seat.offset ?? 1))}
        form={s.form}
        morph={s.tune.morph}
        photoUrl={s.url || undefined}
        seed={s.seed}
        tune={tuneFor(item, seat.haze ?? 0)}
        room={s.room}
        glassMode={s.mode}
        sheetMode={s.sheetMode}
        face={s.face}
        sheetSize={s.tune.sheetSize}
        facing={s.facing}
        viewPitch={s.viewPitch}
        viewToken={s.facing === undefined ? undefined : `${s.facing}|${s.viewPitch}`}
        locked={s.viewLocked}
        focused={seat.focused}
        still={seat.still}
        frameloop={field.busy ? "always" : seat.frameloop}
        onPick={pickRef.current ? pick : undefined}
      />
    );
  }, [tuneFor, field]);

  const adjustSeat = useCallback((curve: SeatDepth, offset: number, viewport: { w: number; h: number }, item: ArchiveArtifact): SeatPlace => {
    const i = indexOf(item);
    const onCurve = adjustCurveSeat(curve, offset, viewport);
    const state = resolveRef.current(item);
    // the library's size grows or shrinks the canvas with the eye where it was, so the vessel scales in its seat
    const room = vesselCanvasScale(state.form, state.tune.morph) * (state.size ?? 1);
    if (i < 0) return withCanvasRoom(onCurve, room);
    if (Math.abs(offset) < 0.5) field.apex = i;
    const share = field.share[i] ?? 0;
    const place = memoryFieldPlace(i, item.look?.vividness);
    const seated = carouselContainsOffset(offset) && onCurve.opacity > 0.02;
    const placed = share <= 0
      ? seated ? onCurve : surfacingSeat(place, field.cam, viewport)
      : blendSeat(
        seated
          ? { ...onCurve, haze: 0, order: onCurve.order ?? Math.round(offset * 100), depth: FIELD_FOCAL / Math.max(onCurve.scale, 1e-3) }
          : surfacingSeat(place, field.cam, viewport),
        fieldSeat(place, field.cam, viewport, field.hover[i] ?? 0),
        share, viewport, variantOf(i), field.direction,
      );
    return withCanvasRoom(placed, room);
  }, [indexOf, field]);

  const toggle = useCallback(() => setField(!field.on, field.apex), [setField, field]);
  const chrome = useMemo(() => <><FieldToggle on={fieldOn} onToggle={toggle} /><LibraryToggle /></>, [fieldOn, toggle]);
  // The curve only has ten seats in view. The lab's ten can all stay mounted.
  // A longer archive — the memories page — leaves the rest unmounted until the
  // field is open, so their canvases don't crowd out the pond's.
  const fieldLive = list.length <= 10 || fieldOn || field.whole > 0.001 || field.busy;

  const override = useMemo<GalleryOverride>(() => ({
    ...(items ? { items } : {}),
    renderArtifact, adjustSeat, wash: false, chrome,
    arrival: "plain",
    ...(fieldLive ? { field: { on: fieldOn, progress: field.whole, hovered: hoveredId, onHover: onFieldHover, onPick: onFieldPick } } : {}),
  }), [items, renderArtifact, adjustSeat, chrome, fieldOn, hoveredId, onFieldHover, onFieldPick, field, frame, revision, fieldLive, list.length]);

  return <GalleryOverrideContext.Provider value={override}>{children}</GalleryOverrideContext.Provider>;
}

/** /memory — the gallery lab's vessels, with whatever side panel was last pushed. */
export function LiveVesselGallery({
  active = true,
  panels,
  pushedAt,
  onFocus,
  children,
}: {
  active?: boolean;
  panels?: GalleryPanelPush[];
  pushedAt: number;
  onFocus?: (id: string) => void;
  children: ReactNode;
}) {
  const byId = useMemo(() => new Map((panels ?? []).map((row) => [row.id, row.panel])), [panels]);
  const library = useGalleryLibrary();
  const seated = useMemo(() => {
    const map = new Map<string, VesselState>();
    curatedStates().forEach((base, i) => {
      const id = LIFE_EVENTS[i].id;
      map.set(id, overCurated(base, byId.get(id), pushedAt));
    });
    return map;
  }, [byId, pushedAt, library.version]);
  const extras = useRef(new Map<string, { key: string; state: VesselState }>());
  const resolve = useCallback((item: ArchiveArtifact) => {
    const known = seated.get(item.id);
    if (known) return known;
    const panel = byId.get(item.id);
    const key = `${formKey(item.shape.form)}|${item.shape.evolve}|${item.look?.photoUrl ?? ""}|${item.look?.vividness ?? ""}|${JSON.stringify(item.look?.oklch)}|${panel ? pushedAt : ""}`;
    const hit = extras.current.get(item.id);
    if (hit?.key === key) return hit.state;
    const base = vesselForArchive(item);
    const state = panel ? withPanel(base, panel) : base;
    extras.current.set(item.id, { key, state });
    return state;
  }, [seated, byId, pushedAt]);
  const cacheKeyFor = useCallback((item: ArchiveArtifact) => {
    const i = curatedIndex(item.id);
    const shape = i >= 0 ? entrySignature(library.entries[i]) : "own";
    return byId.has(item.id) ? `${item.id}|${pushedAt}|${shape}` : `${item.id}|${shape}`;
  }, [byId, pushedAt, library]);
  useEffect(() => {
    const urls = [...curatedStates().map((state) => state.url), ...buildArchive().map((item) => item.look?.photoUrl ?? "")].filter(Boolean);
    preloadSeatPhotos(urls);
  }, []);
  // on a phone the gallery shows only name and year under the vessel: pressing
  // the vessel in hand opens its whole text (MemoryReadingPane)
  const compact = useCompact();
  const [reading, setReading] = useState<ReadableMemory | null>(null);
  const read = useCallback((item: ArchiveArtifact) => {
    setReading({ id: item.id, event: item.event, year: item.year, transcript: item.transcript ?? "" });
  }, []);
  return (
    <VesselGalleryProvider active={active} resolve={resolve} cacheKeyFor={cacheKeyFor} revision={`${pushedAt}|${library.version}`} onFocus={onFocus}
      onPick={compact ? read : undefined}>
      {children}
      <MemoryReadingPane memory={reading} onClose={() => setReading(null)} />
    </VesselGalleryProvider>
  );
}


/** /lab/gallery — the live dive gallery, seated with vessels. */
export function VesselGalleryPreview() {
  // each memory as the memories page has it, then as the editor leaves it.
  // version rebuilds the seat; echo remounts the open panel when the page's knobs change under it.
  const [vessels, setVessels] = useState(draftsFromStore);
  const [editing, setEditing] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<string | undefined>(undefined);
  const live = useGalleryPush();
  const seenAt = useRef<number | null>(null);
  useEffect(() => {
    const at = live?.at ?? 0;
    if (seenAt.current === null) {
      seenAt.current = at;
      return;
    }
    if (!live || seenAt.current === at) return;
    seenAt.current = at;
    setVessels((all) => {
      let changed = false;
      const next = all.map((v, i) => {
        const panel = live.panels.find((row) => row.id === seatId(i))?.panel;
        if (!panel || panelEquals(v.state, panel)) return v;
        changed = true;
        return { state: withPanel(v.state, panel), version: v.version + 1, echo: v.echo + 1 };
      });
      return changed ? next : all;
    });
  }, [live]);

  const items = useMemo<ArchiveArtifact[]>(() => SEATS.map(({ event }, i) => {
    const e = LIFE_EVENTS[event];
    const s = vessels[i].state;
    return {
      id: e.id,
      year: e.year,
      event: e.event,
      transcript: e.transcript,
      highlightedWords: e.highlightedWords,
      colorIndex: e.color % COLOR_PALETTE.length,
      shape: { form: s.form, fluidity: 0.7, evolve: s.tune.morph, bumpAmount: 0 },
      look: { photoUrl: s.url },
    };
  }), [vessels]);
  const resolve = useCallback((item: ArchiveArtifact) => {
    const i = items.findIndex((it) => it.id === item.id);
    return vessels[i]?.state ?? vessels[0].state;
  }, [items, vessels]);
  const cacheKeyFor = useCallback((item: ArchiveArtifact) => {
    const i = items.findIndex((it) => it.id === item.id);
    return `${item.id}|${vessels[i]?.version ?? 0}`;
  }, [items, vessels]);
  const onPick = useCallback((item: ArchiveArtifact) => {
    const i = items.findIndex((it) => it.id === item.id);
    if (i < 0) return;
    setReturnTo(item.id);
    setEditing(i);
  }, [items]);
  if (editing !== null) {
    const i = editing;
    const s = vessels[i].state;
    const stored = live?.panels.find((row) => row.id === items[i].id)?.panel;
    const onThePage = overCurated(seatBase(i), stored, live?.at ?? 0);
    return (
      <>
        <VesselPreview
          key={`${items[i].id}|${vessels[i].echo}`}
          initial={s}
          photos={PHOTOS}
          yaw={-s.tune.anchorAngle}
          backLabel="back to the gallery"
          onBack={() => setEditing(null)}
          onChange={(next) => setVessels((all) => {
            const cur = all[i].state;
            const same = (Object.keys(next) as (keyof VesselState)[]).every((k) => cur[k] === next[k]);
            return same ? all : all.map((v, k) => (k === i ? { ...v, state: { ...next, size: cur.size }, version: v.version + 1 } : v));
          })}
        />
        <LabPushButton
          mark={JSON.stringify(panelFromState(s))}
          liveMark={JSON.stringify(panelFromState(onThePage))}
          onPush={() => pushGalleryPanel(items[i].id, panelFromState(s))}
        />
      </>
    );
  }

  return (
    <VesselGalleryProvider items={items} resolve={resolve} cacheKeyFor={cacheKeyFor} revision={vessels} onPick={onPick} onFocus={setReturnTo}>
      <main style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", background: "#e4e4e6" }}>
        <div aria-label="memory gallery" style={{ position: "absolute", inset: 0 }}>
          <MemoryCarouselPage galleryFocusId={returnTo} galleryCarried={returnTo !== undefined} />
        </div>
      </main>
    </VesselGalleryProvider>
  );
}
