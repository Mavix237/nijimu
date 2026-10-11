import { LIFE_EVENTS, MemoryEvent } from "../data/memoryData";
import { COLOR_PALETTE } from "./colors";
import { loadMemories, toMemoryEvent, SavedMemory, type MemoryLook } from "./memoryStore";
import { curatedShape } from "./galleryLibrary";
import { hashString, mulberry32 } from "./seededRandom";
import { ArtifactForm, formForMemory } from "./superformula";

/*
 * The archive, as the carousel reads it.
 *
 * Two screens show the same rim of memories — the naming step (with the memory
 * being made at the apex) and the homescreen dive gallery — so the list they
 * draw from has to be built in one place. Any drift in the order, or in the
 * seeded form a curated memory gets, shows up as artifacts changing shape and
 * swapping seats when the flow moves from one screen to the other.
 */

export interface ArchiveArtifact {
  /** The memory's id — stable across screens, so it can key the rim slots. */
  id: string;
  year: string;
  event: string;
  /** The words the memory was recorded with. */
  transcript: string;
  /** The words lifted out of it in the highlight step. */
  highlightedWords: string[];
  colorIndex: number;
  shape: {
    form: ArtifactForm;
    fluidity: number;
    evolve: number;
    bumpAmount: number;
  };
  /** Drop anchor in puddle uv (y up) — only the homescreen has water to ripple. */
  anchor?: { x: number; y: number };
  /** Photo, color and frost from the sculpting steps, when the memory has them. */
  look?: MemoryLook;
}

const yearOf = (year: string) => parseInt(year) || 0;

/** A saved memory replays the form it was given and the surface the user
    sculpted; a curated one wears its shape from the gallery library. */
function artifactFor(event: MemoryEvent, index: number, saved?: SavedMemory): ArchiveArtifact {
  // Deterministic per-memory texture, for a memory the library does not hold.
  const rand = mulberry32(hashString(`shape|${event.id}|${event.year}|${event.event}`));
  // The first draw once picked a GLB model. It is still taken, so every
  // curated memory keeps the texture it had.
  rand();
  const y = saved ? null : curatedShape(event.id);
  return {
    id: event.id,
    year: event.year,
    event: event.event,
    transcript: event.transcript,
    highlightedWords: event.highlightedWords,
    colorIndex: event.color % COLOR_PALETTE.length,
    shape: saved
      ? {
          form: saved.shape.form,
          fluidity: saved.shape.fluidity,
          evolve: saved.shape.evolve,
          bumpAmount: saved.shape.bumpAmount,
        }
      : {
          form: y?.form ?? formForMemory(event.id),
          fluidity: y ? 0 : rand() * 0.5 + 0.5,
          evolve: y ? y.morph : rand() * 0.5 + 0.5,
          bumpAmount: y ? 0 : index % 2 === 0 ? rand() * 0.03 : 0.03 + rand() * 0.12,
        },
    // a curated memory has no look of its own but its colour
    ...(saved?.look ? { look: saved.look } : event.feeling ? { look: { oklch: event.feeling } } : {}),
  };
}

/**
 * Every memory, oldest at the left, newest at the right — the rim's direction.
 * The sort is stable, so memories sharing a year keep list order and a memory
 * just saved sits last among them.
 */
export function buildArchive(saved: SavedMemory[] = loadMemories()): ArchiveArtifact[] {
  const artifacts = [
    ...LIFE_EVENTS.map((event, i) => artifactFor(event, i)),
    ...saved.map((memory, i) =>
      artifactFor(toMemoryEvent(memory), LIFE_EVENTS.length + i, memory),
    ),
  ];
  return artifacts.sort((a, b) => yearOf(a.year) - yearOf(b.year));
}

/**
 * Where a memory being made falls in time. It goes after everything at least
 * as old as it — the seat it will hold once it is saved and the archive is
 * rebuilt, so the rim the naming step shows is the rim the gallery keeps.
 */
export function insertChronologically(
  archive: ArchiveArtifact[],
  draft: ArchiveArtifact,
): { items: ArchiveArtifact[]; index: number } {
  const year = yearOf(draft.year);
  let index = 0;
  while (index < archive.length && yearOf(archive[index].year) <= year) index++;
  return {
    items: [...archive.slice(0, index), draft, ...archive.slice(index)],
    index,
  };
}
