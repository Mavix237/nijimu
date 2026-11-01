/*
 * The paper's finish everywhere but the landing, after the gallery's: one
 * look for the grain and the tooth, so every screen past Enter wears the
 * same paper.
 *
 *  · the fine grain — white noise, one grain per device pixel, ±PAPER_GRAIN/2
 *    added to the colour. The gallery's puddle shader adds it itself (the
 *    reference). Everything else lays it as DOM layers (`fineGrainTiles`,
 *    <PaperFinish fine />): the pond stage over the pond, the descent and
 *    naming (whose shaders no longer add their own — each scene's render
 *    passes softened it differently), and the surfaces that blur what is
 *    under them (glass panes, the phone menu).
 *  · the tooth — a soft grey noise tile laid over everything (vessels and
 *    words too) in soft-light: `toothTile`, drawn at the gallery panel's
 *    `texture` (size 140 px, amount .12, soft-light), by <PaperFinish />.
 *
 * The landing keeps its own paper (landingLook, BlobScene's grain canvas,
 * the washes' tooth). Materials keep theirs too: the film's grain, the
 * pond's ink, the washes, the glass.
 */

import { useSyncExternalStore } from "react";
import { LIGHT_TIER } from "./deviceTier";

/** The fine grain's strength (the gallery's settling, 2026-11-01): ±.0175 of the colour, per device pixel. */
export const PAPER_GRAIN = 0.035;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let tooth: string | null = null;
/** The gallery's tooth: a 256 px tile of grey noise, seeded so it is the same on every visit. */
export function toothTile(): string {
  if (tooth !== null) return tooth;
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return (tooth = "");
  const img = ctx.createImageData(256, 256);
  const rand = mulberry32(0x6e696a69);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 200;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (tooth = c.toDataURL("image/png"));
}

const FINE_TILE = 256;
/** The ground the darker half is evened for (the grounds past Enter run ≈ .75–.96; .88 is their middle). */
const FINE_GROUND = 0.88;
let fine: { light: string; dark: string } | null = null;
/**
 * The fine grain as DOM layers: the same white noise the gallery's water adds,
 * ±PAPER_GRAIN/2 per device pixel, as two tiles from one draw. The lighter
 * half is white laid in `plus-lighter` (a true add, whatever the ground); the
 * darker half black laid over (it takes n of a ground near FINE_GROUND). Each
 * tile holds the noise at full alpha; `FINE_OPACITY` scales it down in the
 * compositor, so the faint values are not lost to 8-bit alpha.
 */
export function fineGrainTiles(): { light: string; dark: string } {
  if (fine !== null) return fine;
  if (typeof document === "undefined") return { light: "", dark: "" };
  const make = () => {
    const c = document.createElement("canvas");
    c.width = c.height = FINE_TILE;
    const ctx = c.getContext("2d");
    return { c, ctx, img: ctx?.createImageData(FINE_TILE, FINE_TILE) };
  };
  const light = make(), dark = make();
  if (!light.ctx || !dark.ctx || !light.img || !dark.img) return (fine = { light: "", dark: "" });
  const rand = mulberry32(0x67726e31);
  for (let i = 0; i < light.img.data.length; i += 4) {
    const n = rand() * 2 - 1; // −1…1 of the half-amplitude
    const a = Math.round(Math.abs(n) * 255);
    const lit = light.img.data, shade = dark.img.data;
    lit[i] = lit[i + 1] = lit[i + 2] = 255;
    lit[i + 3] = n > 0 ? a : 0;
    shade[i] = shade[i + 1] = shade[i + 2] = 0;
    shade[i + 3] = n < 0 ? a : 0;
  }
  light.ctx.putImageData(light.img, 0, 0);
  dark.ctx.putImageData(dark.img, 0, 0);
  return (fine = { light: light.c.toDataURL("image/png"), dark: dark.c.toDataURL("image/png") });
}

/** Measured against the gallery (σ of the screen's fine detail, 2.5 levels there), the
    DOM layers read ~10% stronger over the pond's paler sky; this evens them. */
const FINE_MATCH = 0.9;
/** The paler ground the "lite" mode's lighter half is evened for (normal blending only). */
const LITE_GROUND = 0.92;

/**
 * The fine layers' opacities for a grain strength (the gallery panel's
 * backdrop grain, PAPER_GRAIN as built), already scaled for the device.
 * "full" adds the lighter half in plus-lighter; "lite" lays both halves in
 * normal blending (no blend mode for the compositor to work through), the
 * lighter one evened for a pale ground.
 */
export function fineOpacity(grain: number, mode: FinishMode): { light: number; dark: number } {
  const half = (grain * finishScale().grain) / 2 * FINE_MATCH;
  return mode === "lite"
    ? { light: half / (1 - LITE_GROUND), dark: half / FINE_GROUND }
    : { light: half, dark: half / FINE_GROUND };
}

/** The fine tile's size in CSS px: one grain per device pixel (to 2×, as the water
    renders; to 3× on a phone, so its grain is as fine as its screen). */
export function fineGrainSize(): number {
  const cap = LIGHT_TIER ? 3 : 2;
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, cap);
  return FINE_TILE / dpr;
}

/** True on the landing itself, which keeps its own paper. */
export function onLanding(): boolean {
  return typeof window !== "undefined" && window.location.pathname === "/";
}

/* ── the device ──────────────────────────────────────────────────────── */

/**
 * On a phone the finish is finer and fainter: the grain at PHONE.grain of its
 * strength (and one grain per device pixel up to 3×, `fineGrainSize`), the
 * tooth at PHONE.tooth of its amount and PHONE.toothSize of its size. Held
 * close to the screen, at 3× density, the gallery's desktop grain read as
 * dirt rather than paper.
 */
export const PHONE = { grain: 0.55, tooth: 0.5, toothSize: 0.7 } as const;

/** What the device multiplies the panel's values by (1 on a desktop). */
export function finishScale(): { grain: number; tooth: number; toothSize: number } {
  return LIGHT_TIER ? PHONE : { grain: 1, tooth: 1, toothSize: 1 };
}

/* ── the mode: a way out if the finish costs too much ────────────────── */

/**
 * full — fine grain and tooth, as designed.
 * lite — the fine grain alone, in normal blending: no blend modes and no
 *        tooth, so nothing for the compositor to blend over a moving canvas.
 * off  — no finish at all, the landing's grain included (the gallery's
 *        water draws none either).
 *
 * `?finish=full|lite|off` sets it and keeps it on this device (localStorage
 * `nijimu.finish`), so a phone under test stays as asked across reloads;
 * `?finish=auto` forgets it. Unset, the device starts at "full" and the
 * watchdog may step it down (one step at a time, never back up in a visit).
 */
export type FinishMode = "full" | "lite" | "off";
const MODES: FinishMode[] = ["full", "lite", "off"];
const STORE = "nijimu.finish";

function readForced(): FinishMode | null {
  if (typeof window === "undefined") return null;
  try {
    const asked = new URLSearchParams(window.location.search).get("finish");
    if (asked === "auto") { localStorage.removeItem(STORE); return null; }
    if (asked && (MODES as string[]).includes(asked)) { localStorage.setItem(STORE, asked); return asked as FinishMode; }
    const kept = localStorage.getItem(STORE);
    return kept && (MODES as string[]).includes(kept) ? (kept as FinishMode) : null;
  } catch {
    return null;
  }
}

const forced = readForced();
let mode: FinishMode = forced ?? "full";
const listeners = new Set<() => void>();

export const finishMode = () => mode;
/** True when `?finish=` (or a kept choice) set the mode; the watchdog leaves it alone. */
export const finishForced = () => forced !== null;

export function setFinishMode(next: FinishMode, why?: string) {
  if (next === mode) return;
  mode = next;
  if (why) console.info(`[nijimu] paper finish → ${next} (${why}); ?finish=full|lite|off to choose`);
  listeners.forEach((l) => l());
}

export function subscribeFinishMode(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useFinishMode(): FinishMode {
  return useSyncExternalStore(subscribeFinishMode, finishMode, finishMode);
}

/**
 * The watchdog: while the finish is on screen (past Enter, or the landing's
 * grain), it reads the frame clock in 2 s windows. Three windows running whose
 * median frame is slower than SLOW_MS (under ~25 fps — a 30 fps low-power
 * screen is left alone) step the finish down a mode. It only listens; a slow
 * scene may be slow for other reasons, and the step is logged in the console.
 */
const SLOW_MS = 40;
const WINDOW_MS = 2000;
const SLOW_WINDOWS = 3;
let watching = false;

export function startFinishWatchdog() {
  if (watching || forced || typeof window === "undefined") return;
  watching = true;
  let frames: number[] = [];
  let last = performance.now();
  let windowStart = last;
  let slow = 0;
  const tick = (now: number) => {
    const dt = now - last;
    last = now;
    // a hidden tab, or a long pause (a dialog, a debugger) says nothing about drawing
    if (!document.hidden && dt < 500) frames.push(dt);
    if (now - windowStart >= WINDOW_MS) {
      if (frames.length > 10) {
        frames.sort((a, b) => a - b);
        const median = frames[frames.length >> 1];
        slow = median > SLOW_MS ? slow + 1 : 0;
        if (slow >= SLOW_WINDOWS) {
          const next = MODES[MODES.indexOf(mode) + 1];
          if (next) setFinishMode(next, `frames at ${median.toFixed(0)} ms`);
          slow = 0;
        }
      }
      frames = [];
      windowStart = now;
    }
    if (mode !== "off") requestAnimationFrame(tick);
    else watching = false;
  };
  requestAnimationFrame(tick);
}
