import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/app/components/PuddleTranscriptPage.tsx", import.meta.url),
  "utf8",
);

assert.match(source, /navigate\(TRANSCRIPT_PATH \+ location.search,\s*\{/,
  "settled transcription stays on the absolute transcript route");
assert.doesNotMatch(source, /navigate\(["']\.["'],\s*\{\s*replace:\s*true/,
  "the shared LandingPage route must not resolve a relative transcript replace");
assert.match(source, /state:\s*\{\s*\.\.\.state, memoryId, transcript, transcriptReady: !isTyping, highlightMode,/,
  "route replacement preserves completed words, flow identity and reading progress");
assert.match(source, /highlightedWords: highlightedPhrases\(words, highlightedWords\), highlightedWordIndices: indices/,
  "completed highlights are saved along with the transcript");

console.log("Transcript route check passed: completion remains on /record/transcript.");
