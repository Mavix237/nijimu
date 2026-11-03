import { ARTIFACT_CATEGORIES, createArtifactForm, type ArtifactCategory, type ArtifactForm, type SuperParams } from "../lib/superformula";
import { FILM_TUNE_DEFAULT, type FilmTune } from "../lib/filmTune";
import { GALLERY_TUNE_DEFAULT } from "../lib/galleryTune";
import { GROUND } from "../lib/atmosphere";
import { oklchToHex, rgbToOklch, type Oklch } from "../lib/oklch";
import { STOCKS } from "../lab/filmStrip";
import {
  FORM_SLIDERS, KNOBS, PITCH_MAX, PITCH_MIN, TEXTURES,
  type GlassMode, type Room, type SheetFace, type SheetMode, type VesselTune,
} from "../lab/VesselPreview";
import { PHOTOS, VESSEL_GALLERY_ROOM, VESSEL_GALLERY_TUNE } from "../lab/VesselGalleryPreview";
import type { VesselReflection, VesselSheen } from "../lab/VesselArtifact";
import photoA from "../../assets/memory-photo.jpg";
import photoB from "../../assets/memory-photo-02.jpg";

/*
 * The vessel studio's settings: one object holding everything the page can
 * set (StudioSettings), the two DialKit panels' configs built from it, and
 * the mapping both ways — panel values → settings (what is drawn and what is
 * exported) and settings → panel values (an imported file, a memory loaded
 * from the gallery). The studio opens on the gallery's vessel as built:
 * VESSEL_GALLERY_TUNE, its room, its reflection and sheen, the film as built.
 */

export const STUDIO_APP = "nijimu-vessel-studio";

/** "gallery": the gallery's own ground, read live from its panel — its colour, vignette, grain and tooth, over the whole page. */
export type BackdropKind = "gallery" | "transparent" | "solid" | "gradient";
export type ExportBackground = "backdrop" | "transparent";
export const ASPECTS = ["1:1", "4:5", "3:4", "2:3", "16:9", "9:16"] as const;
export const RESOLUTIONS = ["1080", "2048", "3000", "4096"] as const;

export interface StudioSettings {
  app: typeof STUDIO_APP;
  version: 1;
  form: ArtifactForm;
  tune: VesselTune;
  mode: GlassMode;
  sheetMode: SheetMode;
  face: SheetFace;
  room: Room;
  /** The strip sized to the cavity (fitSheetSize) rather than the drape's `sheetSize`. */
  fitSheet: boolean;
  film: FilmTune;
  reflection: Omit<VesselReflection, "water">;
  sheen: VesselSheen;
  photo: string;
  seed: number;
  /** The wall angle the eye faces, from the sheet's own (degrees), and its height. */
  view: { around: number; pitch: number };
  /** The frame exported: its aspect, the vessel's size in it (share of its short side) and offset. */
  frame: { aspect: (typeof ASPECTS)[number]; size: number; x: number; y: number };
  backdrop: { kind: BackdropKind; top: string; bottom: string };
}

export const STUDIO_PHOTOS = PHOTOS.length ? PHOTOS : [photoA, photoB];

export const STUDIO_DEFAULT: StudioSettings = {
  app: STUDIO_APP,
  version: 1,
  form: createArtifactForm({ seed: "vessel|flower", category: "flower" }),
  // the strip gathers where a round wall narrows, rather than pleating into teeth at its sides
  tune: { ...VESSEL_GALLERY_TUNE, gather: 1 },
  mode: "refract",
  sheetMode: "draped",
  face: "glass",
  room: { ...VESSEL_GALLERY_ROOM },
  fitSheet: true,
  film: { ...FILM_TUNE_DEFAULT },
  reflection: { ...GALLERY_TUNE_DEFAULT.reflection },
  sheen: { ...GALLERY_TUNE_DEFAULT.sheen },
  photo: STUDIO_PHOTOS[0],
  seed: 3.1,
  view: { around: 0, pitch: VESSEL_GALLERY_TUNE.pitch },
  frame: { aspect: "4:5", size: 0.78, x: 0, y: 0 },
  backdrop: { kind: "gallery", top: GROUND, bottom: GROUND },
};

/* ───────── panel configs ───────── */

type Range = [number, number, number, number];
const range = (v: number, min: number, max: number, step: number): Range => [Math.min(max, Math.max(min, v)), min, max, step];
const select = (options: readonly (string | { value: string; label: string })[], def: string) => ({ type: "select" as const, options: [...options], default: def });
const color = (def: string) => ({ type: "color" as const, default: def });
const action = (label: string) => ({ type: "action" as const, label });

/** The tune's folders on the "vessel" panel, from the lab's own knob list; form and camera live on "studio". */
const TUNE_GROUPS = KNOBS.filter((g) => !["form", "camera", "scene", "memory colour"].includes(g.group));
const TINT_KEYS = new Set(["memoryTintHue", "memoryTintChroma", "memoryTintLight"]);

const hexOf = (h: number, c: number, l: number) => oklchToHex({ l, c, h });
export function hexToOklch(hex: string): Oklch {
  const p = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16) || 0;
  return rgbToOklch(((p >> 16) & 255) / 255, ((p >> 8) & 255) / 255, (p & 255) / 255);
}

const SET_KEYS = FORM_SLIDERS.map((s) => s.key);
const formKnob = (set: "top" | "side", key: keyof SuperParams) => `${set}${key[0].toUpperCase()}${key.slice(1)}`;

export function studioConfig(s: StudioSettings, memories: { value: string; label: string }[], saved: { value: string; label: string }[] = []) {
  const formFolder: Record<string, unknown> = {
    category: select(ARTIFACT_CATEGORIES, s.form.category),
    draw: action("draw a form in this category"),
    morph: range(s.tune.morph, 0, 1, 0.01),
  };
  for (const set of ["top", "side"] as const) {
    for (const sl of FORM_SLIDERS) {
      formFolder[formKnob(set, sl.key)] = range(s.form[set][sl.key] ?? 1, sl.min, sl.max, sl.step ?? 0.01);
    }
  }
  formFolder.radial = range(s.form.proportion?.radial ?? 1, 0.4, 2, 0.01);
  formFolder.vertical = range(s.form.proportion?.vertical ?? 1, 0.4, 2, 0.01);
  return {
    // the vessels kept on this machine (savedVessels.ts): every setting and the photo
    saved: {
      _collapsed: false,
      name: { type: "text" as const, default: "", placeholder: "name this vessel" },
      save: action("save this vessel"),
      vessel: select([{ value: "", label: saved.length ? "—" : "none kept yet" }, ...saved], ""),
      open: action("load it"),
      remove: action("delete it"),
    },
    source: {
      _collapsed: false,
      memory: select([{ value: "", label: "—" }, ...memories], ""),
      load: action("load this memory"),
      gallery: action("copy for gallery"),
    },
    form: formFolder,
    photo: {
      picture: { type: "image" as const, options: STUDIO_PHOTOS.map((u, i) => ({ value: u, label: `still ${i + 1}` })), default: s.photo },
      seed: range(s.seed, 0, 10, 0.01),
    },
    look: {
      glass: select(["refract", "frost"], s.mode),
      sheet: select(["draped", "pressed"], s.sheetMode),
      face: select(["glass", "inside"], s.face),
    },
    view: {
      around: range(s.view.around, -180, 180, 1),
      pitch: range(s.view.pitch, PITCH_MIN, PITCH_MAX, 0.5),
      turn: range(s.tune.turn, 0, 0.4, 0.005),
      reset: action("back to this view"),
    },
    frame: {
      aspect: select(ASPECTS, s.frame.aspect),
      size: range(s.frame.size, 0.2, 1.6, 0.01),
      x: range(s.frame.x, -0.5, 0.5, 0.005),
      y: range(s.frame.y, -0.5, 0.5, 0.005),
    },
    backdrop: {
      kind: select(["gallery", "solid", "gradient", "transparent"], s.backdrop.kind),
      top: color(s.backdrop.top),
      bottom: color(s.backdrop.bottom),
    },
    export: {
      _collapsed: false,
      resolution: select(RESOLUTIONS.map((r) => ({ value: r, label: `${r} px long side` })), "3000"),
      background: select([{ value: "backdrop", label: "with the backdrop" }, { value: "transparent", label: "transparent" }], "backdrop"),
      png: action("export png"),
      settings: action("download settings (.json)"),
      import: action("import settings…"),
      copy: action("copy tune diff (code)"),
    },
  };
}

export function vesselConfig(s: StudioSettings) {
  const t = s.tune;
  const out: Record<string, Record<string, unknown>> = {};
  for (const g of TUNE_GROUPS) {
    const folder: Record<string, unknown> = { _collapsed: !["refraction", "dye"].includes(g.group) };
    if (g.group === "surface") folder.texture = select(TEXTURES, TEXTURES[Math.round(t.texKind)] ?? TEXTURES[0]);
    if (g.group === "drape") folder.fitSheet = s.fitSheet;
    for (const k of g.knobs) folder[k.key] = range(t[k.key] as number, k.min, k.max, k.step);
    if (g.group === "flow") folder.flowStock = range(t.flowStock, 0, STOCKS.length, 1);
    out[g.group] = folder;
    if (g.group === "refraction") out.room = { _collapsed: true, above: color(s.room.above), below: color(s.room.below) };
    if (g.group === "dye") out.film = {
      _collapsed: false,
      leak: range(s.film.leak, 0, 1.5, 0.01), cool: range(s.film.cool, 0, 1, 0.01),
      halation: range(s.film.halation, 0, 0.6, 0.005), split: range(s.film.split, 0, 1, 0.01), bloom: range(s.film.bloom, 0, 2, 0.01),
    };
  }
  out.colour = {
    _collapsed: true,
    stain: color(hexOf(t.memoryTintHue, t.memoryTintChroma, t.memoryTintLight)),
    memoryTintAmount: range(t.memoryTintAmount, 0, 1, 0.01),
    memoryTintDepth: range(t.memoryTintDepth, 0, 1, 0.01),
    memoryTintReach: range(t.memoryTintReach ?? 0.5, 0.05, 1, 0.01),
    memoryTintFootTop: range(t.memoryTintFootTop ?? 0.03, 0, 0.3, 0.005),
    memoryTintFootBlend: range(t.memoryTintFootBlend ?? 0.16, 0, 0.6, 0.005),
    memoryTintDeepL: range(t.memoryTintDeepL ?? 0.06, -0.2, 0.4, 0.005),
    memoryTintDeepC: range(t.memoryTintDeepC ?? 1.1, 0, 3, 0.01),
    ownFoot: t.memoryTintFootLight !== undefined,
    foot: color(t.memoryTintFootLight !== undefined ? hexOf(t.memoryTintFootHue ?? 0, t.memoryTintFootChroma ?? 0, t.memoryTintFootLight) : "#8f979c"),
    memoryFlash: range(t.memoryFlash, 0, 1, 0.01),
    flashEvery: range(t.flashEvery, 1, 12, 0.1),
    flashGain: range(t.flashGain, 0, 3, 0.01),
  };
  out.reflection = {
    _collapsed: true,
    strength: range(s.reflection.strength, 0, 1, 0.01), fall: range(s.reflection.fall, 0.05, 2, 0.01),
    gap: range(s.reflection.gap, 0, 0.3, 0.005), soft: range(s.reflection.soft, 0, 12, 0.05), room: range(s.reflection.room, 0, 1, 0.01),
  };
  const sh = s.sheen;
  out.sheen = {
    _collapsed: true,
    amount: range(sh.amount, 0, 1.5, 0.01), color: color(sh.color), edge: color(sh.edge),
    x: range(sh.x, -1, 1, 0.01), y: range(sh.y, -1, 1, 0.01), size: range(sh.size, 0.05, 1.5, 0.01),
    soft: range(sh.soft, 0, 1, 0.01), rim: range(sh.rim, 0, 1, 0.01), tilt: range(sh.tilt, -90, 90, 1),
    speed: range(sh.speed, 0, 1, 0.01), wander: range(sh.wander, 0, 0.6, 0.01), breath: range(sh.breath, 0, 1, 0.01),
  };
  return out;
}

/* ───────── panel values → settings ───────── */

type Values = Record<string, Record<string, unknown>>;
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);

export function settingsFrom(studio: Values, vessel: Values, base: StudioSettings): StudioSettings {
  const tune: VesselTune = { ...base.tune };
  for (const g of TUNE_GROUPS) {
    const f = vessel[g.group] ?? {};
    for (const k of g.knobs) (tune[k.key] as number) = num(f[k.key], tune[k.key] as number);
  }
  const surface = vessel.surface ?? {};
  const tex = TEXTURES.indexOf(surface.texture as (typeof TEXTURES)[number]);
  if (tex >= 0) tune.texKind = tex;
  tune.flowStock = num(vessel.flow?.flowStock, tune.flowStock);
  const c = vessel.colour ?? {};
  const stain = hexToOklch(str(c.stain, "#a9b0b4"));
  tune.memoryTintHue = stain.h; tune.memoryTintChroma = stain.c; tune.memoryTintLight = stain.l;
  for (const key of ["memoryTintAmount", "memoryTintDepth", "memoryTintReach", "memoryTintFootTop", "memoryTintFootBlend", "memoryTintDeepL", "memoryTintDeepC", "memoryFlash", "flashEvery", "flashGain"] as const) {
    (tune[key] as number) = num(c[key], (tune[key] as number | undefined) ?? 0);
  }
  if (c.ownFoot === true) {
    const foot = hexToOklch(str(c.foot, "#8f979c"));
    tune.memoryTintFootLight = foot.l; tune.memoryTintFootChroma = foot.c; tune.memoryTintFootHue = foot.h;
  } else {
    delete tune.memoryTintFootLight; delete tune.memoryTintFootChroma; delete tune.memoryTintFootHue;
  }
  const form = studio.form ?? {};
  tune.morph = num(form.morph, tune.morph);
  const view = studio.view ?? {};
  tune.turn = num(view.turn, tune.turn);
  const pitch = num(view.pitch, base.view.pitch);
  tune.pitch = pitch;
  const set = (which: "top" | "side"): SuperParams => {
    const out = { ...base.form[which] };
    for (const key of SET_KEYS) out[key] = num(form[formKnob(which, key)], out[key] ?? 1);
    return out;
  };
  const radial = num(form.radial, 1), vertical = num(form.vertical, 1);
  const nextForm: ArtifactForm = {
    category: (ARTIFACT_CATEGORIES as readonly string[]).includes(form.category as string) ? (form.category as ArtifactCategory) : base.form.category,
    top: set("top"), side: set("side"),
    ...(radial !== 1 || vertical !== 1 ? { proportion: { radial, vertical } } : {}),
  };
  const look = studio.look ?? {};
  const fr = studio.frame ?? {};
  const bd = studio.backdrop ?? {};
  const film = vessel.film ?? {};
  const rf = vessel.reflection ?? {};
  const sh = vessel.sheen ?? {};
  const photo = studio.photo ?? {};
  return {
    ...base,
    form: nextForm,
    tune,
    mode: look.glass === "frost" ? "frost" : "refract",
    sheetMode: look.sheet === "pressed" ? "pressed" : "draped",
    face: look.face === "inside" ? "inside" : "glass",
    room: { above: str(vessel.room?.above, base.room.above), below: str(vessel.room?.below, base.room.below) },
    fitSheet: vessel.drape?.fitSheet !== false,
    film: {
      leak: num(film.leak, base.film.leak), cool: num(film.cool, base.film.cool), halation: num(film.halation, base.film.halation),
      split: num(film.split, base.film.split), bloom: num(film.bloom, base.film.bloom),
    },
    reflection: {
      strength: num(rf.strength, base.reflection.strength), fall: num(rf.fall, base.reflection.fall),
      gap: num(rf.gap, base.reflection.gap), soft: num(rf.soft, base.reflection.soft), room: num(rf.room, base.reflection.room),
    },
    sheen: {
      amount: num(sh.amount, base.sheen.amount), color: str(sh.color, base.sheen.color), edge: str(sh.edge, base.sheen.edge),
      x: num(sh.x, base.sheen.x), y: num(sh.y, base.sheen.y), size: num(sh.size, base.sheen.size), soft: num(sh.soft, base.sheen.soft),
      rim: num(sh.rim, base.sheen.rim), tilt: num(sh.tilt, base.sheen.tilt), speed: num(sh.speed, base.sheen.speed),
      wander: num(sh.wander, base.sheen.wander), breath: num(sh.breath, base.sheen.breath),
    },
    photo: str(photo.picture, base.photo),
    seed: num(photo.seed, base.seed),
    view: { around: num(view.around, base.view.around), pitch },
    frame: {
      aspect: (ASPECTS as readonly string[]).includes(fr.aspect as string) ? (fr.aspect as StudioSettings["frame"]["aspect"]) : base.frame.aspect,
      size: num(fr.size, base.frame.size), x: num(fr.x, base.frame.x), y: num(fr.y, base.frame.y),
    },
    backdrop: {
      kind: bd.kind === "transparent" || bd.kind === "gradient" || bd.kind === "solid" ? bd.kind : "gallery",
      top: str(bd.top, base.backdrop.top), bottom: str(bd.bottom, base.backdrop.bottom),
    },
  };
}

/* ───────── settings → panel values (import, a loaded memory) ───────── */

/** The values the panels take for these settings: everything but the actions and the source picker. */
export function valuesFor(s: StudioSettings): { studio: Values; vessel: Values } {
  const strip = (config: Record<string, unknown>): Values => {
    const out: Values = {};
    for (const [folder, controls] of Object.entries(config)) {
      const f: Record<string, unknown> = {};
      for (const [key, c] of Object.entries(controls as Record<string, unknown>)) {
        if (key === "_collapsed") continue;
        if (Array.isArray(c)) f[key] = c[0];
        else if (c && typeof c === "object") {
          const o = c as { type: string; default?: string };
          if (o.type === "action") continue;
          f[key] = o.default ?? "";
        } else f[key] = c;
      }
      out[folder] = f;
    }
    return out;
  };
  const studio = strip(studioConfig(s, []));
  delete studio.saved;
  delete studio.source;
  delete studio.export;
  return { studio, vessel: strip(vesselConfig(s)) };
}

/** A settings file read back: anything missing or malformed keeps the default. */
export function parseSettings(text: string): StudioSettings {
  const raw = JSON.parse(text) as Partial<StudioSettings>;
  if (!raw || typeof raw !== "object" || !raw.tune || !raw.form) throw new Error("not a vessel studio settings file");
  const d = STUDIO_DEFAULT;
  const tune = { ...d.tune };
  for (const [k, v] of Object.entries(raw.tune)) if (typeof v === "number" && Number.isFinite(v)) (tune as Record<string, number>)[k] = v;
  return {
    ...d, ...raw,
    app: STUDIO_APP, version: 1,
    tune,
    room: { ...d.room, ...raw.room },
    film: { ...d.film, ...raw.film },
    reflection: { ...d.reflection, ...raw.reflection },
    sheen: { ...d.sheen, ...raw.sheen },
    view: { ...d.view, ...raw.view },
    frame: { ...d.frame, ...raw.frame },
    backdrop: { ...d.backdrop, ...raw.backdrop },
  };
}

/** The tune keys moved off the gallery's, as a TS object to paste into a default. */
export function tuneDiff(t: VesselTune): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(t)) {
    const was = (VESSEL_GALLERY_TUNE as unknown as Record<string, number | undefined>)[k];
    if (typeof v === "number" && (was === undefined || Math.abs(v - was) > 1e-6)) lines.push(`  ${k}: ${Math.round(v * 10000) / 10000},`);
  }
  return lines.length ? `{\n${lines.join("\n")}\n}` : "{} // as the gallery";
}
