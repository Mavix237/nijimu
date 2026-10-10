// Shared memory data used across the application
import { sampleField, type Oklch } from "../lib/oklch";
export { MEMORY_COLORS as COLORS } from "../lib/colors";

export interface MemoryEvent {
  id: string;
  year: string;
  event: string;
  color: number; // Index into COLORS array
  /** What the person said when recording it. The curated ones are hypothetical,
      each in its own file in ./transcripts, named by id. */
  transcript: string;
  /** The words lifted out of the transcript in the highlight step. */
  highlightedWords: string[];
  /** The colour step's pick: the glass's stain and its highlights' colour. */
  feeling?: Oklch;
}

// ./transcripts/<id padded to 2>-<slug>.txt — the leading number is the id.
const TRANSCRIPTS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("./transcripts/*.txt", { eager: true, query: "?raw", import: "default" }) as Record<string, string>,
  ).map(([path, text]) => [String(parseInt(path.split("/").pop()!, 10)), text.trim()]),
);

// What the curated memories' speaker would have highlighted, by id — a word or
// a short run of words, each as it appears in that memory's transcript. A run
// is lifted out (and inked in the gallery's trail) as one phrase.
const HIGHLIGHTS: Record<string, string[]> = {
  "0": ["winter", "orange peels", "radiators", "picked out a name", "three different stories", "mall"],
  "1": ["little silver digital camera", "corner of the kitchen", "underwater", "keep a corner of a room", "memory card", "empty"],
  "2": ["fox that lived in a well", "the ending myself", "pencil", "running after it"],
  "3": ["coats", "collars", "mom's old scarves", "pillow", "how something falls", "weight"],
  "4": ["train", "a room inside me", "had a door", "one sentence", "on my hand", "rewrote it by losing it"],
  "5": ["edges", "the window", "four o'clock", "rectangle", "paying attention"],
  "6": ["poster", "two pixels", "three in the morning", "that kind of bother", "wall", "where it started"],
  "7": ["apples", "one long strip", "sorry", "nothing to hide behind", "true"],
  "8": ["radiator", "pale green", "hollow", "already forgotten me", "dried flower"],
  "9": ["average", "decide alone", "photograph", "in tune", "a quiet voice"],
  "10": ["fight", "only birthdays", "whole language", "a room in a house", "the key"],
  "11": ["hands", "shaking", "ten minutes", "standing still", "whoever stops"],
  "12": ["comment", "color of the light", "just voices", "laughed", "breathing somewhere"],
  "13": ["three separate lives", "poem", "one beat too long", "white space", "same rhythm", "paying attention"],
  "14": ["notice", "light", "wall", "a cup with both hands", "without asking"],
  "15": ["definition", "the whole sky", "tea", "cut his hair in the kitchen", "redefining"],
};

// Where each curated memory's speaker would have touched the colour field
// (lib/oklch: u across the hues from rose round to rose, v down from pale to
// deep), by id — read from its transcript, and spread over the whole spectrum.
const FEELINGS: Record<string, { u: number; v: number }> = {
  "0": { u: 0.125, v: 0.45 }, // winter, orange peels on the radiators — sand-orange
  "1": { u: 0.43, v: 0.4 }, // the little green screen, underwater — sea green
  "2": { u: 0.21, v: 0.5 }, // a summer stairwell, a pencil — amber
  "3": { u: 0.93, v: 0.45 }, // coats and collars, mother's scarves — rose-violet
  "4": { u: 0.81, v: 0.55 }, // a door inside — violet
  "5": { u: 0.24, v: 0.3 }, // the window's four o'clock light — pale yellow
  "6": { u: 0.04, v: 0.6 }, // a poster at three in the morning — brick red
  "7": { u: 0.33, v: 0.55 }, // an apple peeled in one strip — apple green
  "8": { u: 0.39, v: 0.35 }, // one wall painted pale green — green
  "9": { u: 0.68, v: 0.65 }, // the dark photograph, a quiet voice — slate blue
  "10": { u: 0.61, v: 0.7 }, // a room without the key — grey blue
  "11": { u: 0.14, v: 0.4 }, // hands, someone standing still — sand
  "12": { u: 0.75, v: 0.6 }, // late calls across time zones — indigo
  "13": { u: 0.53, v: 0.5 }, // white space after a stanza — teal
  "14": { u: 0.056, v: 0.35 }, // light on a wall, a cup in both hands — peach
  "15": { u: 0.97, v: 0.55 }, // tea, a haircut in the kitchen — rose
};

const withTranscripts = (events: Omit<MemoryEvent, "transcript" | "highlightedWords">[]): MemoryEvent[] =>
  events.map((e) => {
    const at = FEELINGS[e.id];
    return {
      ...e,
      transcript: TRANSCRIPTS[e.id] ?? "",
      highlightedWords: HIGHLIGHTS[e.id] ?? [],
      ...(at ? { feeling: sampleField(at.u, at.v) } : {}),
    };
  });

export const LIFE_EVENTS: MemoryEvent[] = withTranscripts([
  { id: "0", year: "2003", event: "Born in Beijing", color: 0 },
  { id: "1", year: "2009", event: "First camera", color: 1 },
  { id: "2", year: "2012", event: "The first urge to write a story", color: 2 },
  { id: "3", year: "2016", event: "Wanted to be a fashion designer", color: 3 },
  { id: "4", year: "2017", event: "Read a book that changed my life", color: 4 },
  { id: "5", year: "2020", event: "The year everything slowed down", color: 5 },
  { id: "6", year: "2021", event: "Started designing seriously", color: 6 },
  { id: "7", year: "2021", event: "Wrote something true for the first time", color: 7 },
  { id: "8", year: "2022", event: "Left a place I thought I'd stay longer", color: 8 },
  { id: "9", year: "2023", event: "Started learning to trust my own eye", color: 9 },
  { id: "10", year: "2024", event: "A friendship that quietly ended", color: 0 },
  { id: "11", year: "2024", event: "Showed work I wasn't sure about", color: 1 },
  { id: "12", year: "2024", event: "Met someone through a screen", color: 2 },
  { id: "13", year: "2025", event: "Finding the thread between\npoetry, film, and design", color: 3 },
  { id: "14", year: "2025", event: "Found my muse", color: 4 },
  { id: "15", year: "2026", event: "Still figuring out what love means", color: 5 },
]);

