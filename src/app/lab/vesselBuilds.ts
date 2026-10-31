import { useEffect, useState } from "react";
import { formKey, type ArtifactForm } from "../lib/superformula";
import { buildDrapedSheet, buildGlass, buildSheet, fitSheetSize, type Glass, type Sheet, type SheetMode, type VesselTune } from "./VesselPreview";

/*
 * The glass and its settled cloth for one memory, built once for the visit
 * and shared by everything that draws it: the gallery's seats, the naming
 * vessel, the distance step's neighbours. The cloth's settle is the costly
 * part (tens of milliseconds a memory on a laptop, several times that on a
 * phone), so builds also queue: one per task, the nearest first, and the page
 * paints between them instead of stopping for every memory at once.
 *
 * The geometries are shared between canvases (each WebGL renderer uploads its
 * own buffers from the same arrays). A caller never disposes them; a build
 * leaving the cache frees its GPU buffers, and a canvas still drawing it
 * simply uploads it again.
 */

export interface VesselParts {
  glass: Glass;
  sheet: Sheet;
  /** The strip's size in the glass: the one given, or fitted to this cavity. */
  sheetSize: number;
}

export interface VesselRequest {
  form: ArtifactForm;
  morph: number;
  tune: VesselTune;
  sheetMode: SheetMode;
  seed: number;
  /** The strip's size; fitted to the cavity (`fitSheetSize`) unless given. */
  sheetSize?: number;
}

/** Only what shapes the glass and the cloth: a change of haze or colour reuses the build. */
export function vesselPartsKey(r: VesselRequest): string {
  const t = r.tune;
  const cloth = r.sheetMode === "draped"
    ? [t.anchorAngle, t.anchorHeight, t.tilt, t.contact, t.sag, t.peel, t.curl, t.twist, t.gap, t.soft]
    : [r.seed, t.arc, t.band, t.lift, t.foldScale];
  return [formKey(r.form), r.morph, r.sheetMode, t.inset, r.sheetSize ?? "fit", ...cloth].join("|");
}

/** Enough for the curated memories, the visit's own, and a few edited versions. */
const LIMIT = 48;
const cache = new Map<string, VesselParts>();

function remember(key: string, parts: VesselParts) {
  cache.set(key, parts);
  while (cache.size > LIMIT) {
    const [oldest, old] = cache.entries().next().value as [string, VesselParts];
    cache.delete(oldest);
    old.glass.geometry.dispose();
    old.sheet.geometry.dispose();
  }
}

function build(r: VesselRequest): VesselParts {
  const t = r.tune;
  const glass = buildGlass(r.form, r.morph);
  // the strip sized to this cavity, so a small or narrow form holds a smaller sheet
  const sheetSize = r.sheetSize ?? fitSheetSize(glass);
  const sheet = r.sheetMode === "draped"
    ? buildDrapedSheet(glass, t.inset, {
      sheetSize, anchorAngle: t.anchorAngle, anchorHeight: t.anchorHeight, tilt: t.tilt, contact: t.contact,
      sag: t.sag, peel: t.peel, curl: t.curl, twist: t.twist, gap: t.gap, soft: t.soft,
    })
    : buildSheet(glass, t.inset, t.arc, t.band, t.lift, t.foldScale, r.seed);
  return { glass, sheet, sheetSize };
}

/** The parts now, building them on the spot if they are not cached. */
export function vesselParts(r: VesselRequest): VesselParts {
  const key = vesselPartsKey(r);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const parts = build(r);
  remember(key, parts);
  return parts;
}

/** The parts if they are already built. */
export function peekVesselParts(r: VesselRequest): VesselParts | undefined {
  return cache.get(vesselPartsKey(r));
}

/* ───────── the queue ───────── */

interface Job { key: string; request: VesselRequest; priority: number; order: number; waiting: Set<(p: VesselParts) => void> }
const jobs = new Map<string, Job>();
let order = 0;
let pumping = false;

/* A macrotask between builds, so the browser can paint and handle input. A
   MessageChannel does not wait out setTimeout's clamping. */
const channel = typeof MessageChannel === "function" ? new MessageChannel() : null;
function nextTask(run: () => void) {
  if (channel) { channel.port1.onmessage = run; channel.port2.postMessage(0); }
  else setTimeout(run, 0);
}

function pump() {
  if (pumping) return;
  pumping = true;
  nextTask(() => {
    pumping = false;
    let best: Job | undefined;
    for (const job of jobs.values()) {
      if (!best || job.priority < best.priority || (job.priority === best.priority && job.order < best.order)) best = job;
    }
    if (!best) return;
    jobs.delete(best.key);
    const parts = vesselParts(best.request);
    for (const done of best.waiting) done(parts);
    if (jobs.size) pump();
  });
}

/**
 * Asks for a build. `priority` orders the queue, lowest first (the gallery
 * passes a seat's distance from the apex). Returns a cancel, which drops the
 * caller's interest; a job nobody waits for is not built.
 */
export function requestVesselParts(r: VesselRequest, priority: number, done: (p: VesselParts) => void): () => void {
  const key = vesselPartsKey(r);
  let job = jobs.get(key);
  if (!job) { job = { key, request: r, priority, order: order++, waiting: new Set() }; jobs.set(key, job); }
  else job.priority = Math.min(job.priority, priority);
  job.waiting.add(done);
  pump();
  const mine = job;
  return () => {
    mine.waiting.delete(done);
    if (!mine.waiting.size && jobs.get(mine.key) === mine) jobs.delete(mine.key);
  };
}

/** The parts for a vessel: at once if built, otherwise null until the queue reaches it. */
export function useVesselParts(r: VesselRequest, priority: number): VesselParts | null {
  const key = vesselPartsKey(r);
  const [have, setHave] = useState<{ key: string; parts: VesselParts } | null>(null);
  const cached = peekVesselParts(r);
  const parts = cached ?? (have?.key === key ? have.parts : null);
  useEffect(() => {
    if (peekVesselParts(r)) return;
    return requestVesselParts(r, priority, (p) => setHave({ key, parts: p }));
    // the key stands for the request's contents
  }, [key, priority]); // eslint-disable-line react-hooks/exhaustive-deps
  return parts;
}
