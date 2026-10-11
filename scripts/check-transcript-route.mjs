import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const archived = readFileSync(
  new URL("../src/app/archive/highlight-transcript/PuddleTranscriptPage.tsx", import.meta.url),
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

assert.match(archived, /navigate\(TRANSCRIPT_PATH \+ location.search,\s*\{/,
  "the archived highlight screen still keeps its own draft on /record/transcript");
assert.match(recording, /navigate\(DESCENT_PATH,/,
  "recording and the sample open the descent");
assert.doesNotMatch(recording, /TRANSCRIPT_PATH/,
  "recording no longer opens the highlight screen");
assert.doesNotMatch(descent, /PuddleTranscriptPage/,
  "the descent no longer mounts the highlight screen");
assert.match(descent, /navigate\(RECORD_START_PATH,/,
  "photo back returns to recording");
assert.match(app, /TRANSCRIPT_PATH, Component: ArchivedTranscriptRedirect/,
  "an old transcript bookmark redirects into the descent");
assert.doesNotMatch(gallery, /highlightedWords|trailInkWash|fontStyle: "italic"/,
  "the gallery trail no longer inks highlighted phrases");

console.log("Transcript route check passed: highlight screen is archived, gallery ink is gone.");
