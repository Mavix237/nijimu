import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as contract from "../shared/memory-assessment.mjs";
import { assessMemory } from "../server/assess-memory.mjs";
import { assessmentResponse, MAX_BODY_BYTES } from "../server/assessment-http.mjs";
import { POST } from "../api/assess-memory.mjs";

function load(path, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in imports, name); return imports[name]; }, ...globals });
  return module.exports;
}
const geometry = load("../src/app/lib/superformula.ts");
const rhythm = load("../src/app/lib/memoryRhythm.ts");
const shape = load("../src/app/lib/memoryShape.ts", { "./superformula": geometry, "../../../shared/memory-assessment.mjs": contract });
const sample = load("../src/app/data/sampleMemory.ts", { "../lib/memoryShape": shape });
assert.ok(contract.isAssessment(sample.SAMPLE_ASSESSMENT, sample.SAMPLE_TRANSCRIPT));
const demo = sample.sampleAssignment(sample.SAMPLE_TRANSCRIPT);
assert.ok(shape.isMemoryAssignment(demo, sample.SAMPLE_TRANSCRIPT));
assert.ok(demo.family && demo.source !== "fallback");
assert.equal(sample.sampleAssignment(sample.SAMPLE_TRANSCRIPT + " I feel differently now."), null);
assert.equal(JSON.stringify(demo), JSON.stringify(sample.sampleAssignment(sample.SAMPLE_TRANSCRIPT)));
// The imported rise/naming animation carries this branch's memory unchanged.
const colors = load("../src/app/lib/colors.ts");
const naming = load("../src/app/lib/namingDraft.ts", { "./colors": colors, "./superformula": geometry });
const carried = {
  memoryId: "echo-draft", transcript: sample.SAMPLE_TRANSCRIPT, assignment: demo,
  highlightedWords: ["summer"], matPresetIndex: 2,
  shape: { form: demo.form, evolve: .73, fluidity: 0, bumpAmount: 0 },
  look: { photoUrl: "blob:chosen-photo", vividness: .34, oklch: { l: .8, c: .1, h: 224 } },
};
const draft = naming.draftAsSaved({ draftId: carried.memoryId, state: carried });
assert.equal(draft.id, carried.memoryId);
assert.equal(draft.assignment, demo);
assert.equal(draft.shape.form, demo.form);
assert.equal(draft.shape.evolve, .73);
assert.equal(draft.look, carried.look, "photo, colour and distance survive the draft transition");
assert.equal(draft.transcript, carried.transcript);
// Rhythm is a manual latitude edit, preserving the assessed interpretation.
const edited = rhythm.withRhythm(demo.form, 9.25);
assert.equal(edited.side.m, 9.25);
assert.equal(edited.top, demo.form.top);
for (const key of ['n1', 'n2', 'n3', 'a', 'b']) assert.equal(edited.side[key], demo.form.side[key]);
assert.notEqual(edited.side, demo.form.side);
const editedDraft = naming.draftAsSaved({ draftId: carried.memoryId, state: { ...carried, form: edited, shape: { ...carried.shape, form: edited } } });
assert.equal(editedDraft.shape.form, edited);
assert.equal(editedDraft.assignment, demo, 'manual rhythm preserves original assessment metadata');
const resume = naming.resumeColorState({ ...carried, rise: true, shape: { ...carried.shape, form: edited } });
assert.equal(resume.resumeStep, 'color', 'Back resumes the current descent color step');
assert.equal(resume.rise, undefined);
assert.equal(resume.shape.form, edited, 'Back keeps the manually edited m2');
assert.equal(resume.shape.evolve, carried.shape.evolve);
assert.equal(resume.memoryAssignment, demo, 'Back preserves the original transcript assessment');
assert.equal(resume.look, carried.look, 'Back keeps the chosen photo, color and distance');
assert.equal(resume.memoryId, carried.memoryId);
assert.equal(resume.transcript, carried.transcript);

// Absolute thumb–index aperture: closed -> 0, wider -> more m2. Distances
// are relative to the palm, independent of camera aspect, scale, and mirroring.
const pinchHand = (ratio, aspect = 1, scale = 1, mirrored = false) => {
  const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  hand[0] = { x: 0, y: .2 };
  hand[9] = { x: 0, y: .1 };
  hand[4] = { x: 0, y: 0 };
  hand[8] = { x: ratio * .1 / aspect, y: 0 };
  return hand.map(p => ({ x: .5 + p.x * scale * (mirrored ? -1 : 1), y: .3 + p.y * scale }));
};
const { closed, open } = rhythm.RHYTHM_PINCH;
const middleGap = (closed + open) / 2;
assert.equal(rhythm.rhythmFromPinch(pinchHand(0)), 0);
assert.equal(rhythm.rhythmFromPinch(pinchHand(open + .1)), 16);
assert.ok(Math.abs(rhythm.rhythmFromPinch(pinchHand(middleGap)) - 8) < 1e-9);
for (const aspect of [1, 4/3, 16/9]) for (const scale of [.5, 1, 1.8]) for (const mirror of [false, true]) {
  assert.ok(Math.abs(rhythm.rhythmFromPinch(pinchHand(middleGap, aspect, scale, mirror), aspect) - 8) < 1e-9);
}
let previousTarget = -1;
for (let gap = 0; gap < 1.7; gap += .025) {
  const target = rhythm.rhythmFromPinch(pinchHand(gap));
  assert.ok(target >= previousTarget && target >= 0 && target <= 16);
  previousTarget = target;
}
assert.equal(rhythm.rhythmFromPinch([]), null);
assert.equal(rhythm.rhythmFromPinch(pinchHand(open, 1, .01)), null, 'unreliable tiny palm is ignored');
const invalidHand = pinchHand(open); invalidHand[4].x = NaN;
assert.equal(rhythm.rhythmFromPinch(invalidHand), null);
const pinch = rhythm.createRhythmPinch();
let currentM = 8, now = 0, previousEditAt = -Infinity;
assert.equal(pinch.update(pinchHand(open + .1), 1, now, currentM), null, 'acquisition eases from the current form');
for (let frame = 1; frame <= 150; frame++) {
  now += 16;
  const next = pinch.update(pinchHand(open + .1), 1, now, currentM);
  if (next !== null) {
    assert.ok(next >= currentM && next <= 16);
    assert.ok(now - previousEditAt >= 100, 'mesh updates stay under 10 Hz');
    assert.equal(next * 4, Math.round(next * 4));
    currentM = next; previousEditAt = now;
  }
}
assert.equal(currentM, 16, 'wide aperture reaches maximum');
assert.equal(pinch.update([], 1, now + 16, currentM), null, 'tracking loss holds the current form');
assert.equal(pinch.update(pinchHand(0), 1, now += 32, currentM), null, 'reacquisition starts from the held value');
for (let frame = 1; frame <= 150; frame++) {
  const next = pinch.update(pinchHand(0), 1, now += 16, currentM);
  if (next !== null) { assert.ok(next <= currentM); currentM = next; }
}
assert.equal(currentM, 0, 'closed aperture reaches minimum');
pinch.reset(); currentM = 8;
for (let frame = 0; frame < 120; frame++) {
  const gap = middleGap + Math.sin(frame) * .005;
  assert.equal(pinch.update(pinchHand(gap), 1, now += 16, currentM), null, 'small landmark jitter does not rebuild the mesh');
}
for (const category of geometry.ARTIFACT_CATEGORIES) {
  const base = geometry.baseForm(category);
  for (const m2 of [0, .25, 4, 9.25, 16]) {
    const form = rhythm.withRhythm(base, m2);
    assert.ok(geometry.isArtifactForm(form));
    const mesh = geometry.getArtifactMesh(form);
    assert.ok(mesh.positions.every(Number.isFinite), `${category} rhythm ${m2} must remain finite`);
  }
}
const namingArtifact = naming.draftArtifactOf({ draftId: carried.memoryId, state: carried });
assert.equal(namingArtifact.look, carried.look);
assert.equal(geometry.formKey(namingArtifact.shape.form), geometry.formKey(demo.form));
assert.equal(naming.draftShapeOf({ assignment: demo }).form, demo.form, "assignment is retained when only its form is carried");
const transcript = "I felt joyful and reached toward everyone around me.";
const assessment = { orientation: 1, comfort: 0.8, intensity: 0.95, discomfort: 0, disruption: 0, mixedness: 0.1, insufficientEvidence: false, summary: "Joyful, intense openness.", beats: [{ quote: "I felt joyful", reading: "joy", orientation: 1, intensity: 0.95 }] };
assert.ok(contract.isAssessment(assessment, transcript));
assert.ok(contract.validTranscript("我记得那个秋天的午后。"), "Chinese does not need spaces / three words");
assert.ok(!contract.isAssessment({ ...assessment, orientation: 1.01 }));
assert.ok(!contract.isAssessment({ ...assessment, comfort: NaN }));
assert.ok(!contract.isAssessment({ ...assessment, intensity: "0.8" }));
assert.ok(!contract.isAssessment({ ...assessment, beats: [{ ...assessment.beats[0], quote: "invented evidence" }] }, transcript));
assert.ok(!contract.isAssessment({ ...assessment, beats: [] }, transcript));
const assigned = shape.assignMemoryShape(assessment, "one", "api", "test", transcript);
assert.equal(assigned.family, "floral", "positive excitement remains sharp");
assert.ok(assigned.coordinates.sharpness > 0.8);
assert.ok(shape.isMemoryAssignment(assigned, transcript));
assert.ok(!shape.isMemoryAssignment(assigned, `${transcript} But that is not what I remember most.`), "changed whole transcript invalidates an old reading");
assert.ok(!shape.isMemoryAssignment({ ...assigned, form: geometry.baseForm("sphere") }, transcript), "tampered / mismatched form is not carried");
assert.equal(shape.assignMemoryShape({ ...assessment, orientation: -1, intensity: 0, comfort: 1 }, "one").family, "shell");
assert.equal(shape.assignMemoryShape({ ...assessment, orientation: 1, intensity: 0, comfort: 1 }, "one").family, "bowl");
assert.equal(shape.assignMemoryShape({ ...assessment, orientation: -1, intensity: 0.1, discomfort: 1, disruption: 1, comfort: 0 }, "one").family, "tower", "quiet pain can be sharp");
assert.equal(shape.assignMemoryShape({ ...assessment, insufficientEvidence: true }, "one").family, null);
assert.equal(shape.assignMemoryShape(null, "one").family, null);
const tie = shape.assignMemoryShape({ ...assessment, orientation: 0, intensity: 0.5, comfort: 0 }, "one");
assert.equal(tie.family, null, "a tie has no family label");
assert.ok(tie.anchor && geometry.isArtifactForm(tie.form), "the map still gives a tie its form");
assert.equal(shape.assignMemoryShape(null, "one").anchor, null, "no reading keeps the neutral sphere");
assert.equal(geometry.formKey(shape.assignMemoryShape(null, "one").form), geometry.formKey(geometry.baseForm("sphere")));
assert.equal(JSON.stringify(assigned), JSON.stringify(shape.assignMemoryShape(assessment, "one", "api", "test", transcript)), "saved mapping repeats exactly");
assert.notEqual(geometry.formKey(shape.familyForm("shell", "one")), geometry.formKey(shape.familyForm("shell", "two")), "variation stays local");
// The trends the map was drawn with: outward adds profile flares, sharp reaches farther.
assert.ok(shape.MAP_TRENDS.sideM.bOut > 0, "outward has more profile lobes");
assert.ok(shape.MAP_TRENDS.reach.bSharp > 0, "sharp reaches farther past its body");
for (const a of shape.MAP_ANCHORS) {
  const at = shape.formAt(a.outward, a.sharpness, "anchor");
  assert.equal(at.anchor, a.id, `${a.id} is its own nearest`);
  assert.equal(at.form.top.m, a.form.top.m);
  assert.ok(Math.abs(at.form.side.m - a.form.side.m) <= shape.VARIATION.profile + 0.05, `${a.id} keeps its profile near its own`);
  const room = Math.exp(shape.VARIATION.exponent) + 0.001;
  for (const set of ["top", "side"]) for (const key of ["n1", "n2", "n3"]) {
    const ratio = at.form[set][key] / a.form[set][key];
    assert.ok(ratio < room && ratio > 1 / room, `${a.id} ${set}.${key} stays within the seed's room at its own place`);
  }
}
for (let i = 0; i <= 10; i++) {
  for (let j = 0; j <= 10; j++) {
    for (const seed of ["a", "b"]) {
      const { form } = shape.formAt(i / 10, j / 10, seed);
      assert.ok(geometry.isArtifactForm(form), `form at ${i / 10},${j / 10}`);
      const mesh = geometry.buildArtifactMesh(form);
      assert.ok(mesh.vertexCount <= 30000);
      assert.ok([...mesh.positions, ...mesh.normals, ...mesh.sphere].every(Number.isFinite));
      assert.ok(Math.max(...mesh.positions.map(Math.abs)) <= 1.000001);
      assert.ok(mesh.index.every(index => index < mesh.vertexCount));
    }
  }
}
// Scale participates in cache identity, with legacy forms unchanged.
const original = geometry.baseForm("sphere");
const scaled = { ...original, proportion: { radial: 0.8, vertical: 1.2 } };
assert.notEqual(geometry.formKey(original), geometry.formKey(scaled));
assert.ok(!geometry.isArtifactForm({ ...original, proportion: { radial: Infinity, vertical: 1 } }));

// Provider tests do not make paid calls or send personal text.
let request;
const complete = (text = JSON.stringify(assessment)) => ({ model: "fixture-model", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const provider = async (url, options) => {
  assert.equal(url, "https://api.openai.com/v1/responses");
  assert.equal(options.headers.Authorization, "Bearer test-key");
  assert.ok(options.signal instanceof AbortSignal);
  request = JSON.parse(options.body);
  return Response.json(complete());
};
const success = await assessMemory(transcript, "test-key", undefined, provider);
assert.equal(success.status, 200);
assert.equal(success.body.model, "fixture-model");
assert.equal(JSON.parse(request.input[0].content).transcript, transcript, "entire account is sent without summarizing / truncating");
assert.equal(request.model, "gpt-4.1-mini");
assert.equal(request.text.format.type, "json_schema");
assert.equal(request.text.format.strict, true);
assert.equal(request.store, false);
assert.equal((await assessMemory(transcript, undefined)).status, 503);
assert.equal((await assessMemory("x".repeat(5001), "test-key", undefined, provider)).status, 400);
assert.equal((await assessMemory({}, "test-key", undefined, provider)).status, 400);
for (const status of ["incomplete", "failed"]) {
  assert.equal((await assessMemory(transcript, "key", undefined, async () => Response.json({ ...complete(), status }))).status, 502);
}
assert.equal((await assessMemory(transcript, "key", undefined, async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "refused" }] }] }))).status, 502);
for (const status of [401, 429, 500]) {
  const failure = await assessMemory(transcript, "key", undefined, async () => Response.json({ error: "secret provider details" }, { status }));
  assert.equal(failure.status, status === 429 ? 429 : 502);
  assert.ok(!JSON.stringify(failure).includes("secret provider details"));
}
assert.equal((await assessMemory(transcript, "key", undefined, async () => { throw new Error("network failure"); })).status, 502);
assert.equal((await assessMemory(transcript, "key", undefined, async () => new Response("not JSON"))).status, 502);
assert.equal((await assessMemory(transcript, "key", undefined, async () => Response.json(complete("{}")))).status, 502);
assert.equal((await assessmentResponse("{" )).status, 400);
assert.equal((await assessmentResponse(" ".repeat(MAX_BODY_BYTES+1))).status, 413);
assert.equal((await POST(new Request("http://localhost/api/assess-memory", { method: "POST", body: " ".repeat(MAX_BODY_BYTES+1) }))).status, 413);
assert.equal((await POST(new Request("http://localhost/api/assess-memory", { method: "POST", body: "{" }))).status, 400);

// Browser boundary validates independently and forwards aborts.
const client = fetch => load("../src/app/lib/assessMemory.ts", { "../../../shared/memory-assessment.mjs": contract, "../data/sampleMemory": sample }, { fetch, AbortController, setTimeout, clearTimeout });
const goodClient = client(async () => Response.json({ assessment, version: contract.ASSESSMENT_VERSION, model: "test" }));
assert.ok((await goodClient.requestMemoryAssessment(transcript)).assessment);
const forgedClient = client(async () => Response.json({ assessment: { ...assessment, beats: [{ ...assessment.beats[0], quote: "made up" }] }, version: contract.ASSESSMENT_VERSION }));
assert.equal((await forgedClient.requestMemoryAssessment(transcript)).assessment, null);
const controller = new AbortController();
const delayedClient = client((url, { signal }) => new Promise((resolve,reject) => { signal.addEventListener("abort", () => reject(new Error("cancelled"))); }));
const pending = delayedClient.requestMemoryAssessment(transcript, controller.signal); controller.abort();
assert.equal((await pending).assessment, null);
console.log("memory assignment: contract, geometry, replay, stale text, provider, HTTP and cancellation checks passed");

const offlineSampleClient = client(async () => { throw new Error("sample must not need network"); });
assert.ok((await offlineSampleClient.requestMemoryAssessment(sample.SAMPLE_TRANSCRIPT)).assessment);
