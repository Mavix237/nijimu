import { useEffect, useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { DIALS_OPEN } from "../lib/dialsOpen";
import { LIFE_EVENTS } from "../data/memoryData";
import { GALLERY_TUNE_DEFAULT, setGalleryTune, type GalleryTune } from "../lib/galleryTune";
import { FILM_TUNE_DEFAULT as FD, setFilmTune, type FilmTune } from "../lib/filmTune";
import { previewFinishMode, setFinishUnder, type FinishMode } from "../lib/paperFinish";

/*
 * The gallery's dev panel (DialKit). Development only: LiveVesselGallery
 * imports it lazily behind import.meta.env.DEV, and only while the gallery is
 * the screen in front (the landing's own panel is gone by then). Two separate
 * shells, each draggable:
 *
 *   gallery          (bottom right) reflection, sheen, glass (+ room light, frost, dye), room, film, seats, timing, framing
 *   gallery ground   (top left) the paper finish's mode and place (to compare);
 *                    the water's colour, grain, paper and vignette;
 *                    a noise texture and a tint over the whole gallery; a CSS filter
 *   gallery colours  (bottom left) the foot stain (strength, shape, every pick moved together)
 *                    and one folder per curated memory: its stain tone and, with
 *                    "own foot colour" on, the deep band at its very foot
 *
 * Values persist in localStorage (dialkit:nijimu-gallery*). "Copy" in a panel's
 * version menu puts a set on the clipboard, to write back into
 * GALLERY_TUNE_DEFAULT (lib/galleryTune.ts) or the constants it mirrors.
 */

type Range = [number, number, number, number];
const D = GALLERY_TUNE_DEFAULT;

const GLASS_RANGES: Record<keyof GalleryTune["glass"], [number, number, number]> = {
  rim: [0, 1, 0.01],
  thickness: [0, 1, 0.01],
  bend: [0, 2, 0.01],
  glassSoft: [0, 1.5, 0.01],
  bodyAlpha: [0, 1, 0.01],
  thickDark: [0, 1, 0.01],
  highlight: [0, 1, 0.01],
  photoOpacity: [0, 1, 0.01],
  envBelow: [0, 1, 0.01],
  warmth: [0, 1, 0.01],
  frostStrength: [0, 1, 0.01],
  dyeExposure: [-1, 1, 0.01],
  dyeShoulder: [0, 1, 0.01],
  dyeLift: [0, 0.25, 0.005],
};
const SEAT_RANGES: Record<keyof GalleryTune["seats"], [number, number, number]> = {
  focusBoost: [-0.2, 0.3, 0.005],
  shrink1: [-0.3, 0.6, 0.005],
  shrink2: [-0.3, 0.8, 0.005],
  out1: [-0.15, 0.2, 0.005],
  out2: [-0.15, 0.25, 0.005],
  down1: [-0.15, 0.2, 0.005],
  down2: [-0.15, 0.25, 0.005],
  fadeNear: [0, 0.6, 0.01],
  fadeFar: [0, 0.8, 0.01],
};
const TIMING_RANGES: Record<keyof GalleryTune["timing"], [number, number, number]> = {
  transcriptDwellMs: [0, 10000, 100],
  flightMs: [200, 5000, 50],
  staggerMs: [0, 300, 5],
  parallaxX: [0, 0.15, 0.005],
  parallaxY: [0, 0.15, 0.005],
};
const FOOT_RANGES: Record<Exclude<keyof GalleryTune["foot"], "ownFoot">, [number, number, number]> = {
  stain: [0, 1, 0.01],
  depth: [0, 1, 0.01],
  flash: [0, 1, 0.01],
  footTop: [0, 0.4, 0.005],
  footBlend: [0, 0.6, 0.005],
  reach: [0.05, 1, 0.01],
  deepLight: [-0.2, 0.4, 0.005],
  deepChroma: [0, 3, 0.01],
  hueShift: [-180, 180, 1],
  chroma: [0, 3, 0.01],
  lightness: [-0.3, 0.3, 0.005],
};

function sliders<T extends Record<string, number>>(defaults: T, ranges: Record<keyof T, [number, number, number]>, collapsed = false) {
  const folder: Record<string, unknown> = { _collapsed: collapsed };
  for (const key of Object.keys(ranges)) {
    const [min, max, step] = ranges[key as keyof T];
    folder[key] = [defaults[key as keyof T], min, max, step] as Range;
  }
  return folder;
}

/** "2003 · Born in Beijing", per curated memory, in LIFE_EVENTS order. */
const MEMORY_LABELS = LIFE_EVENTS.map((e) => `${e.year} · ${e.event.replace(/\s*\n\s*/g, " ")}`);

const BLENDS = ["soft-light", "overlay", "multiply", "screen", "color-burn", "luminosity", "normal"];

/** The paper finish, for comparing by eye: its mode everywhere past Enter
    ("as is" leaves the built/forced/watchdog mode alone), and, in the
    gallery, whether it lies under the vessels and words or over everything. */
const FINISH_MODES = ["as is", "full", "lite", "off"] as const;

/** The gallery's ground: the water's colour and paper, a texture over everything, a filter. */
const GROUND_CONFIG = {
  finish: {
    mode: { type: "select" as const, options: [...FINISH_MODES], default: "as is" },
    underVessels: false,
  },
  backdrop: {
    color: D.backdrop.color,
    grain: [D.backdrop.grain, 0, 0.4, 0.005] as Range,
    grainSize: [D.backdrop.grainSize, 1, 6, 0.5] as Range,
    paperTexture: [D.backdrop.paperTexture, 0, 6, 0.05] as Range,
    vignette: [D.backdrop.vignette, 0, 1, 0.01] as Range,
  },
  texture: {
    amount: [D.texture.amount, 0, 1, 0.01] as Range,
    size: [D.texture.size, 32, 600, 2] as Range,
    contrast: [D.texture.contrast, 0.2, 4, 0.05] as Range,
    blend: { type: "select" as const, options: BLENDS, default: D.texture.blend },
    tint: D.texture.tint,
    tintAmount: [D.texture.tintAmount, 0, 1, 0.01] as Range,
    tintBlend: { type: "select" as const, options: ["multiply", "color", "soft-light", "overlay", "screen", "normal"], default: D.texture.tintBlend },
  },
  filter: {
    _collapsed: true,
    brightness: [D.filter.brightness, 0.5, 1.5, 0.01] as Range,
    contrast: [D.filter.contrast, 0.5, 1.6, 0.01] as Range,
    saturate: [D.filter.saturate, 0, 2.5, 0.01] as Range,
    sepia: [D.filter.sepia, 0, 1, 0.01] as Range,
    hue: [D.filter.hue, -180, 180, 1] as Range,
    blur: [D.filter.blur, 0, 6, 0.1] as Range,
  },
};

const REFLECTION_RANGES: Record<keyof GalleryTune["reflection"], [number, number, number]> = {
  strength: [0, 0.8, 0.01],
  fall: [0.1, 3, 0.01],
  gap: [-0.2, 0.5, 0.005],
  soft: [0, 24, 0.25],
  room: [0, 1, 0.01],
};

const MAIN_CONFIG = {
  reflection: sliders(D.reflection, REFLECTION_RANGES),
  sheen: {
    amount: [D.sheen.amount, 0, 1.5, 0.01] as Range,
    color: D.sheen.color,
    edge: D.sheen.edge,
    x: [D.sheen.x, -1.5, 1.5, 0.01] as Range,
    y: [D.sheen.y, -1.5, 1.5, 0.01] as Range,
    size: [D.sheen.size, 0.05, 1.5, 0.01] as Range,
    soft: [D.sheen.soft, 0.01, 1, 0.01] as Range,
    rim: [D.sheen.rim, 0, 1, 0.01] as Range,
    tilt: [D.sheen.tilt, -90, 90, 1] as Range,
    speed: [D.sheen.speed, 0, 3, 0.01] as Range,
    wander: [D.sheen.wander, 0, 0.8, 0.01] as Range,
    breath: [D.sheen.breath, 0, 1, 0.01] as Range,
    add: [D.sheen.add, 0, 1, 0.01] as Range,
  },
  glass: sliders(D.glass, GLASS_RANGES),
  room: { above: D.room.above, below: D.room.below },
  film: {
    leak: [FD.leak, 0, 2, 0.01] as Range,
    cool: [FD.cool, 0, 1, 0.01] as Range,
    halation: [FD.halation, 0, 1, 0.01] as Range,
    split: [FD.split, 0, 1, 0.01] as Range,
    bloom: [FD.bloom, 0, 2, 0.01] as Range,
  },
  seats: sliders(D.seats, SEAT_RANGES, true),
  timing: sliders(D.timing, TIMING_RANGES, true),
  framing: { _collapsed: true, maxWidth: [D.framing.maxWidth, 0.3, 1.6, 0.01] as Range },
};

const COLOR_CONFIG = {
  foot: { ...sliders(D.foot as unknown as Record<string, number>, FOOT_RANGES as never), ownFoot: D.foot.ownFoot },
  memories: Object.fromEntries(LIFE_EVENTS.map((e, i) => [MEMORY_LABELS[i], {
    _collapsed: true,
    stain: D.tones[e.id].stain,
    foot: D.tones[e.id].foot,
  }])),
};

/** The panel's values persist, so a colour kept there would cover a tone changed in code since
    (tuned in /studio and written into GALLERY_TUNE_DEFAULT.tones). Its key carries the code's
    tones and foot: change them and the panel opens afresh on them. */
const COLOR_KEY = (() => {
  const text = JSON.stringify([D.tones, D.foot]);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `nijimu-gallery-colours-${(h >>> 0).toString(36)}`;
})();

type Main = Pick<GalleryTune, "glass" | "room" | "seats" | "timing" | "framing" | "reflection" | "sheen"> & { film?: Partial<FilmTune> };
type Ground = Pick<GalleryTune, "backdrop" | "texture" | "filter"> & { finish?: { mode?: string; underVessels?: boolean } };
type Colors = { foot: GalleryTune["foot"]; memories: Record<string, { stain: string; foot: string }> };

export default function GalleryDials() {
  const main = useDialKit("gallery", MAIN_CONFIG as never, { id: "nijimu-gallery", persist: true }) as unknown as Main;
  const colors = useDialKit("gallery colours", COLOR_CONFIG as never, { id: COLOR_KEY, persist: true }) as unknown as Colors;
  const ground = useDialKit("gallery ground", GROUND_CONFIG as never, { id: "nijimu-gallery-ground", persist: true }) as unknown as Ground;

  const key = JSON.stringify([main, colors, ground]);
  const tune = useMemo<GalleryTune>(() => ({
    glass: { ...D.glass, ...main.glass },
    room: { ...D.room, ...main.room },
    seats: { ...D.seats, ...main.seats },
    timing: { ...D.timing, ...main.timing },
    framing: { ...D.framing, ...main.framing },
    reflection: { ...D.reflection, ...main.reflection },
    sheen: { ...D.sheen, ...main.sheen },
    backdrop: { ...D.backdrop, ...ground.backdrop },
    texture: { ...D.texture, ...ground.texture },
    filter: { ...D.filter, ...ground.filter },
    foot: { ...D.foot, ...colors.foot },
    tones: Object.fromEntries(LIFE_EVENTS.map((e, i) => {
      const row = colors.memories?.[MEMORY_LABELS[i]];
      return [e.id, { ...D.tones[e.id], stain: row?.stain ?? D.tones[e.id].stain, foot: row?.foot ?? D.tones[e.id].foot }];
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);

  useEffect(() => { setGalleryTune(tune); }, [tune]);

  // the photo's film look (every vessel), from the "film" folder; as built again when the panel goes
  const filmKey = JSON.stringify(main.film ?? {});
  useEffect(() => { setFilmTune({ ...FD, ...main.film }); }, [filmKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setFilmTune(FD), []);

  const finishPick = ground.finish?.mode ?? "as is";
  const finishUnder = !!ground.finish?.underVessels;
  useEffect(() => {
    previewFinishMode(finishPick === "as is" ? null : finishPick as FinishMode);
  }, [finishPick]);
  useEffect(() => { setFinishUnder(finishUnder); }, [finishUnder]);

  // two shells, one per panel, in opposite corners (DialRoot's `panels` filter is our patch of dialkit)
  return (
    <>
      <DialRoot defaultOpen={DIALS_OPEN} position="bottom-right" theme="light" panels={["gallery"]} />
      <DialRoot defaultOpen={DIALS_OPEN} position="bottom-left" theme="light" panels={["gallery colours"]} />
      <DialRoot defaultOpen={DIALS_OPEN} position="top-left" theme="light" panels={["gallery ground"]} />
    </>
  );
}
