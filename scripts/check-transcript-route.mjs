import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const transcript = readFileSync(
  new URL("../src/app/components/PuddleTranscriptPage.tsx", import.meta.url),
  "utf8",
);
const recording = readFileSync(
  new URL("../src/app/components/PondRecordingOverlay.tsx", import.meta.url),
  "utf8",
);
const descent = readFileSync(
  new URL("../src/app/lab/DescentPrototype.tsx", import.meta.url),
  "utf8",
);
const gallery = readFileSync(
  new URL("../src/app/components/TranscriptTrail.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

assert.match(transcript, /navigate\(TRANSCRIPT_PATH \+ location.search,\s*\{/,
  "the transcript screen keeps the words and completion state in its history entry");
assert.equal((recording.match(/navigate\(TRANSCRIPT_PATH \+ location.search,/g) ?? []).length, 2,
  "both a recording and the sample open the transcript review");
assert.match(transcript, /navigate\(DESCENT_PATH \+ location.search,/,
  "Continue goes directly from the transcript to photo selection");
assert.doesNotMatch(transcript, /highlightMode|highlightedPhrases|handleMouseDown|TRANSCRIPT_HIGHLIGHT/,
  "the live review has no highlighting mode or selection gate");
assert.match(descent, /<PuddleTranscriptPage/,
  "the transcript is chrome within the shared pond scene");
assert.match(descent, /const prelude = invitation \|\| recording \|\| readingTranscript/,
  "photo emergence waits until transcript review is complete");
assert.match(descent, /navigate\(TRANSCRIPT_PATH \+ location.search,/,
  "photo Back returns to the finished transcript");
assert.match(app, /TRANSCRIPT_PATH, element: null/,
  "the transcript belongs to the persistent landing layout");
assert.doesNotMatch(app, /ArchivedTranscriptRedirect/,
  "transcript bookmarks no longer skip the screen");
assert.doesNotMatch(gallery, /highlightedWords|trailInkWash|fontStyle: "italic"/,
  "the gallery trail no longer inks highlighted phrases");

console.log("Transcript route check passed: transcript review restored, highlighting remains archived.");
