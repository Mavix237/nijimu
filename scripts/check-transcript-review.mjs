import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real review component against recorded, pending and lost drafts.
// Only routing, transcription transport and the visual button shells are stubbed.
const require = createRequire(import.meta.url);
const sample = "A sample memory for the pond.";
let location, pending, buttons, navigations;
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const Button = ({ label, onClick, disabled }) => {
    buttons.set(label, { onClick, disabled });
    return React.createElement("button", { disabled }, label);
  };
  runInNewContext(code, {
    module, exports: module.exports, Intl, crypto: { randomUUID },
    window: { setTimeout: callback => { callback(); return 1; }, clearTimeout() {} },
    require(id) {
      if (id === "react-router") return {
        useLocation: () => location,
        useNavigate: () => (to, options) => navigations.push({ to, ...options }),
      };
      if (id === "../lib/transcribe") return { getTranscription: () => pending };
      if (id === "../data/sampleMemory") return { SAMPLE_TRANSCRIPT: sample };
      if (id === "./TextButton") return { TextButton: Button };
      if (id === "./PillButton") return { PillButton: Button };
      if (id === "./FlowPageGrid") return load("../src/app/components/FlowPageGrid.tsx");
      if (id.startsWith("../lib/")) return load(`../src/app/lib/${id.slice(7)}.ts`);
      return require(id);
    },
  });
  cache.set(path, module.exports);
  return module.exports;
}
const { PuddleTranscriptPage } = load("../src/app/components/PuddleTranscriptPage.tsx");
function render(state, transcription = null) {
  location = { state, search: "?camera=off" };
  pending = transcription;
  buttons = new Map();
  navigations = [];
  return renderToStaticMarkup(React.createElement(PuddleTranscriptPage));
}

const draft = {
  transcript: "The wind returned.", transcriptReady: true, memoryId: "recorded-memory",
  transcriptionId: "finished-recording", focus: [0.2, 0.5],
  shape: { form: { seed: "kept-form" } }, memoryAssignment: { marker: "carried" },
};
const finished = render(draft);
assert.match(finished, /returned\./);
assert.doesNotMatch(finished, /transcribing|highlight/);
assert.ok(buttons.has("continue") && buttons.has("record again"));
buttons.get("continue").onClick();
assert.equal(navigations[0].to, "/record/descent?camera=off", "one Continue reaches the photo");
assert.deepEqual(JSON.parse(JSON.stringify(navigations[0].state)), draft, "the full carried draft survives review");
buttons.get("record again").onClick();
assert.equal(navigations[1].to, "/record/start?camera=off");
assert.equal(navigations[1].state.transcriptionId, undefined, "record again drops the previous request");
assert.deepEqual(navigations[1].state.shape, draft.shape);

for (const [state, result] of [
  [{ transcriptionId: "lost" }, null],
  [{ transcriptionId: "lost", transcript: "   " }, null],
  [{ transcriptionId: "failed" }, { result: { transcript: null, error: "Service unavailable" } }],
  [{ transcriptionId: "empty" }, { result: { transcript: "   ", error: null } }],
]) {
  const html = render(state, result);
  assert.match(html, /role="alert"/);
  assert.ok(buttons.has("record again") && !buttons.has("continue"));
  assert.doesNotMatch(html, /sample|returned/, "a failed real recording never shows a substitute memory");
}
const waiting = render({ transcriptionId: "pending" }, { result: null, promise: new Promise(() => {}) });
assert.match(waiting, /transcribing/);
assert.ok(!buttons.has("continue"), "pending words cannot be carried into the photo step");
assert.doesNotMatch(waiting, /sample|returned/);
const restored = render(draft, { result: { transcript: null, error: "Old request expired" } });
assert.ok(buttons.has("continue"), "a saved transcript survives loss of the old request");
assert.doesNotMatch(restored, /role="alert"/);
assert.match(render(null), /sample/, "a direct demo visit retains the built-in sample");
console.log("Transcript review checks passed: finished, waiting, failed, lost, empty, restored and direct demo states; direct photo continuation preserves the draft.");
