import { useEffect, useState } from "react";
import { isArtifactForm, type ArtifactForm } from "./superformula";

/*
 * The gallery lab's side panel — the vessel knobs — is the only push.
 * It writes those parameters for one memory; /memory reads them and draws
 * that vessel with them. The lab reads the same record, so a change that
 * lands here shows up there too. Photo choice is not part of the panel
 * and is not stored.
 */

const GALLERY_KEY = "nijimu.lab.push.gallery";
const GALLERY_EVENT = "nijimu-lab-push-gallery";

export interface GalleryPanel {
  tune: Record<string, number>;
  mode: "frost" | "refract";
  sheetMode: "pressed" | "draped";
  face: "inside" | "glass";
  room: { above: string; below: string };
  form: ArtifactForm;
}

export interface GalleryPanelPush {
  id: string;
  panel: GalleryPanel;
}

export interface GalleryPush {
  at: number;
  panels: GalleryPanelPush[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function tuneOf(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const tune: Record<string, number> = {};
  for (const [key, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    tune[key] = n;
  }
  return Object.keys(tune).length ? tune : null;
}

function panelOf(value: unknown): GalleryPanel | null {
  const s = value as Partial<GalleryPanel> | null;
  if (!s || typeof s !== "object") return null;
  const tune = tuneOf(s.tune);
  if (!tune || !isArtifactForm(s.form)) return null;
  if (s.mode !== "frost" && s.mode !== "refract") return null;
  if (s.sheetMode !== "pressed" && s.sheetMode !== "draped") return null;
  if (s.face !== "inside" && s.face !== "glass") return null;
  if (!s.room || !HEX.test(s.room.above ?? "") || !HEX.test(s.room.below ?? "")) return null;
  return {
    tune, mode: s.mode, sheetMode: s.sheetMode, face: s.face,
    room: { above: s.room.above, below: s.room.below }, form: s.form,
  };
}

export function readGalleryPush(): GalleryPush | null {
  try {
    const raw = JSON.parse(localStorage.getItem(GALLERY_KEY) ?? "null") as { panels?: unknown; seats?: unknown } | null;
    const rows = Array.isArray(raw?.panels) ? raw.panels : Array.isArray(raw?.seats) ? raw.seats : null;
    if (!rows) return null;
    const panels = rows.flatMap((row) => {
      const seat = row as { id?: unknown; panel?: unknown; state?: unknown };
      if (typeof seat?.id !== "string" || !seat.id) return [];
      const panel = panelOf(seat.panel ?? seat.state);
      return panel ? [{ id: seat.id, panel }] : [];
    });
    return panels.length ? { at: Number((raw as { at?: unknown }).at) || 0, panels } : null;
  } catch {
    return null;
  }
}

/** The open memory's side-panel parameters, for the memories page and the lab. */
export function pushGalleryPanel(id: string, panel: GalleryPanel) {
  const kept = (readGalleryPush()?.panels ?? []).filter((row) => row.id !== id);
  const payload: GalleryPush = { at: Date.now(), panels: [...kept, { id, panel }] };
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(payload)); } catch { /* the event still lands if a reader is mounted */ }
  window.dispatchEvent(new Event(GALLERY_EVENT));
}

export function useGalleryPush(): GalleryPush | null {
  const [push, setPush] = useState<GalleryPush | null>(() => readGalleryPush());
  useEffect(() => {
    const sync = () => setPush(readGalleryPush());
    window.addEventListener(GALLERY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GALLERY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return push;
}
