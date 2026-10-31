import { MemoryEvent } from "../data/memoryData";
import type { MemoryAssignment } from "./memoryShape";
import { isArtifactForm, type ArtifactForm } from "./superformula";

const KEY = "nijimu.memories.v1";

/** A guest memory kept in this tab's session, including across refreshes. */
export interface SavedMemory {
  id: string;
  title: string;
  year: string;
  transcript: string;
  /** Original assignment retained alongside the final hand-shaped form. */
  assignment?: MemoryAssignment;
  highlightedWords: string[];
  /** The shape the user sculpted — replayed verbatim, never re-randomized. */
  shape: {
    /** Assigned when the memory was recorded; see lib/superformula.ts. */
    form: ArtifactForm;
    matPresetIndex: number;
    fluidity: number;
    evolve: number;
    bumpAmount: number;
  };
  /** Index into COLOR_PALETTE / MEMORY_COLORS for this memory's tint. */
  colorIndex: number;
  /** Photo, tint and distance replayed by the naming vessel and gallery.
      Optional for older and curated memories. */
  look?: MemoryLook;
  createdAt: string;
}

export interface MemoryLook {
  /** The wrapped photo — an asset URL, or a data / object URL for this visit. */
  photoUrl?: string;
  /** The color step's pick. */
  oklch?: { l: number; c: number; h: number };
  /** 1 = near/clear, 0 = fully frosted and beyond the visible constellation.
   * Shared depth projection lives in vesselField.memoryFieldPlace. */
  vividness?: number;
}

function isSavedMemory(value: unknown): value is SavedMemory {
  if (!value || typeof value !== "object") return false;
  const m = value as SavedMemory;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  return typeof m.id === "string" && !!m.id && typeof m.title === "string"
    && typeof m.year === "string" && typeof m.transcript === "string" && typeof m.createdAt === "string"
    && Array.isArray(m.highlightedWords) && m.highlightedWords.every(word => typeof word === "string")
    && !!m.shape && isArtifactForm(m.shape.form)
    && [m.shape.matPresetIndex, m.shape.fluidity, m.shape.evolve, m.shape.bumpAmount, m.colorIndex].every(finite)
    && (m.look === undefined || (!!m.look && typeof m.look === "object"
      && (m.look.photoUrl === undefined || typeof m.look.photoUrl === "string")
      && (m.look.vividness === undefined || finite(m.look.vividness))
      && (m.look.oklch === undefined || (!!m.look.oklch && [m.look.oklch.l, m.look.oklch.c, m.look.oklch.h].every(finite)))));
}

function restoreSession(): SavedMemory[] {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isSavedMemory) : [];
  } catch {
    return [];
  }
}

/** sessionStorage survives reloads, but isn't a permanent or public archive. */
let session = restoreSession();

function forgetPersisted(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

forgetPersisted();

export function loadMemories(): SavedMemory[] {
  return [...session];
}

/** False means browser storage was blocked/full; callers must not claim a save. */
export function saveMemory(memory: SavedMemory): boolean {
  // Re-saving the same draft updates it rather than duplicating its gallery seat.
  const next = session.some(item => item.id === memory.id)
    ? session.map(item => item.id === memory.id ? memory : item)
    : [...session, memory];
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  session = next;
  return true;
}

/** Presents a saved memory in the same shape as the curated LIFE_EVENTS. */
export function toMemoryEvent(memory: SavedMemory): MemoryEvent {
  return {
    id: memory.id,
    year: memory.year,
    event: memory.title,
    color: memory.colorIndex,
    transcript: memory.transcript,
    highlightedWords: memory.highlightedWords,
  };
}
