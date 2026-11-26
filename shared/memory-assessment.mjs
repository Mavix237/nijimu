/** Shared contract: used by the server and browser. No provider code or secrets. */
export const ASSESSMENT_VERSION = "memory-reading-v1";
export const MAX_TRANSCRIPT_LENGTH = 5000;
export const SCORE_KEYS = ["orientation", "comfort", "intensity", "discomfort", "disruption", "mixedness"];
const scoreProperties = Object.fromEntries(SCORE_KEYS.map(key => [key, {
  type: "number", description: key === "orientation" ? "-1 inward to +1 outward" : "0 to 1",
}]));
export const ASSESSMENT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    ...scoreProperties,
    insufficientEvidence: { type: "boolean" },
    summary: { type: "string", description: "Brief whole-memory interpretation, at most 300 characters; no diagnosis." },
    beats: { type: "array", description: "Up to four meaningful beats, in narrative order. Exact short quotes from the transcript.", items: {
      type: "object", additionalProperties: false,
      properties: { quote: { type: "string" }, reading: { type: "string" }, orientation: scoreProperties.orientation, intensity: scoreProperties.intensity },
      required: ["quote", "reading", "orientation", "intensity"],
    } },
  },
  required: [...SCORE_KEYS, "insufficientEvidence", "summary", "beats"],
};
export function validTranscript(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TRANSCRIPT_LENGTH;
}
export function isAssessment(value, transcript) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).some(key => !ASSESSMENT_SCHEMA.required.includes(key))) return false;
  for (const key of SCORE_KEYS) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < (key === "orientation" ? -1 : 0) || n > 1) return false;
  }
  if (typeof value.insufficientEvidence !== "boolean" || typeof value.summary !== "string" || value.summary.length > 300) return false;
  if (!Array.isArray(value.beats) || value.beats.length > 4 || (!value.insufficientEvidence && value.beats.length === 0)) return false;
  return value.beats.every(beat => beat && typeof beat === "object" &&
    Object.keys(beat).length === 4 &&
    typeof beat.quote === "string" && beat.quote.trim().length > 0 && beat.quote.length <= 500 &&
    (transcript === undefined || transcript.includes(beat.quote)) &&
    typeof beat.reading === "string" && beat.reading.length <= 300 &&
    Number.isFinite(beat.orientation) && beat.orientation >= -1 && beat.orientation <= 1 &&
    Number.isFinite(beat.intensity) && beat.intensity >= 0 && beat.intensity <= 1);
}

/* ───────── repairing a reading before it is checked ─────────
   The model is asked for exact quotes, but on a longer memory it often tidies
   them: joins two passages with "…", drops a leading "and"/"but" and
   capitalises the next word, swaps a comma. One such quote used to throw the
   whole reading away (and the memory fell back to a neutral form). Here each
   quote is found again in the transcript, ignoring case, spacing and
   punctuation, and replaced by the transcript's own words for that stretch;
   a beat that cannot be found is dropped. Quotes stay verbatim, so
   `isAssessment(…, transcript)` still holds wherever it is checked. */

const MAX_TEXT = 300;
const MAX_QUOTE = 500;
const ELLIPSIS = /\.{2,}|…+/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Letters and digits only, lowercased, with each kept character's index in the original. */
function folded(text) {
  let out = "";
  const at = [];
  for (let i = 0; i < text.length; ) {
    const code = text.codePointAt(i);
    const ch = String.fromCodePoint(code);
    if (WORD_CHAR.test(ch)) {
      const low = ch.toLowerCase();
      out += low;
      for (let k = 0; k < low.length; k++) at.push(i);
    }
    i += ch.length;
  }
  return { out, at };
}

/** End index (exclusive) in the original of the folded character at `j`. */
function endOf(text, at, j) {
  const i = at[j];
  return i + String.fromCodePoint(text.codePointAt(i)).length;
}

/** The stretch of `transcript` a quote stands for, or null. */
export function findQuote(quote, transcript, fold = folded(transcript)) {
  if (typeof quote !== "string" || typeof transcript !== "string") return null;
  if (quote.trim() && transcript.includes(quote) && quote.length <= MAX_QUOTE) return quote;
  const parts = quote.split(ELLIPSIS).map(p => folded(p).out).filter(p => p.length > 0);
  if (!parts.length) return null;
  const spans = [];
  let from = 0;
  for (const part of parts) {
    const j = fold.out.indexOf(part, from);
    if (j < 0) return null;
    spans.push([fold.at[j], endOf(transcript, fold.at, j + part.length - 1)]);
    from = j + part.length;
  }
  const whole = transcript.slice(spans[0][0], spans[spans.length - 1][1]);
  if (whole.length <= MAX_QUOTE) return whole;
  // the elided passages span too much: keep the longest one that fits
  const fits = spans.map(([a, b]) => transcript.slice(a, b)).filter(s => s.length <= MAX_QUOTE);
  return fits.sort((a, b) => b.length - a.length)[0] ?? null;
}

function clip(text) {
  if (typeof text !== "string" || text.length <= MAX_TEXT) return text;
  const cut = text.slice(0, MAX_TEXT - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > MAX_TEXT * 0.6 ? cut.slice(0, space) : cut}…`;
}

const clampScore = (value, lo) => (typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(lo, value)) : value);

/**
 * A reading made to fit the contract where it can be without inventing
 * anything: quotes re-found in the transcript (or their beat dropped), at most
 * four beats, summary and readings clipped, scores clamped to their range.
 * Anything it cannot mend is passed through for `isAssessment` to reject.
 */
export function repairAssessment(value, transcript) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof transcript !== "string") return value;
  const out = { ...value };
  for (const key of SCORE_KEYS) out[key] = clampScore(out[key], key === "orientation" ? -1 : 0);
  out.summary = clip(out.summary);
  if (Array.isArray(out.beats)) {
    const fold = folded(transcript);
    out.beats = out.beats
      .map(beat => {
        if (!beat || typeof beat !== "object") return null;
        const quote = findQuote(beat.quote, transcript, fold);
        if (!quote || !quote.trim()) return null;
        return {
          quote, reading: clip(beat.reading),
          orientation: clampScore(beat.orientation, -1), intensity: clampScore(beat.intensity, 0),
        };
      })
      .filter(Boolean)
      .slice(0, 4);
  }
  return out;
}
