/** Keep accented letters and joined emoji together while printing. */
export function transcriptCharacters(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), part => part.segment);
}

/** Pause after a keystroke: quick within words, a breath at word boundaries,
 * and a longer thought at punctuation. Deterministic variation avoids a metronome. */
export function transcriptTypingDelay(character: string, index: number): number {
  const variation = ((index * 17 + character.codePointAt(0)!) % 11) / 10;
  if (/[.!?。！？]/u.test(character)) return 280 + variation * 140;
  if (/[,;:，；：—]/u.test(character)) return 150 + variation * 90;
  if (/\s/u.test(character)) return 85 + variation * 55;
  return 18 + variation * 20;
}

/** The whole printout takes at most this long; a longer memory types faster, keeping its rhythm. */
export const TRANSCRIPT_TYPING_MAX_MS = 8000;

/** What each pause is multiplied by so the printout fits TRANSCRIPT_TYPING_MAX_MS. */
export function transcriptTypingPace(characters: string[]): number {
  let total = 0;
  characters.forEach((character, index) => { total += transcriptTypingDelay(character, index); });
  return total > TRANSCRIPT_TYPING_MAX_MS ? TRANSCRIPT_TYPING_MAX_MS / total : 1;
}
