import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}
const geometry = load('../src/app/lib/superformula.ts');
const { advanceArtifactPose } = load('../src/app/lib/artifactPose.ts');
const { rhythmMorph } = load('../src/app/lib/memoryRhythm.ts');
const base = geometry.baseForm('flower');
const at = m => geometry.getArtifactMesh({ ...base, side: { ...base.side, m } }, 128);
const low = at(0), high = at(16), middle = at(7.25);
// Normal flow may reach Rhythm without ever manipulating Shape (growth=0).
// Its entry value must expose the formula, including for an old saved draft.
for (const growth of [0, .01, .25, .5]) assert.equal(rhythmMorph(growth), .6);
for (const growth of [.6, .8, 1]) assert.equal(rhythmMorph(growth), growth);
const revealedLow = low.positions.slice(), revealedHigh = high.positions.slice();
advanceArtifactPose(revealedLow, low, rhythmMorph(0), 0, true);
advanceArtifactPose(revealedHigh, high, rhythmMorph(0), 0, true);
assert.ok(revealedHigh.some((v, i) => Math.abs(v - high.sphere[i]) > .02), 'zero-growth entry reveals actual folds');
assert.ok(revealedLow.some((v, i) => Math.abs(v - revealedHigh[i]) > .02), 'm2 endpoints visibly differ after entering from a sphere');
for (let m = 0; m <= 16; m += .25) {
  const mesh = at(m);
  assert.equal(mesh.positions.length, low.positions.length, 'all rhythm values retain vertex correspondence');
  assert.deepEqual(mesh.index, low.index, 'indices do not change across sampling thresholds');
  assert.ok(mesh.positions.every(Number.isFinite));
}
const originalHigh = high.positions.slice();
const output = low.positions.slice();
const identity = output;
const posed = mesh => {
  const result = mesh.positions.slice();
  advanceArtifactPose(result, mesh, .73, 0, true);
  return result;
};
output.set(posed(low));
let before = output.slice();
const destination = posed(high);
advanceArtifactPose(output, high, .73, 1 / 60);
for (let i = 0; i < output.length; i++) {
  assert.ok(output[i] >= Math.min(before[i], destination[i]) - 1e-6 && output[i] <= Math.max(before[i], destination[i]) + 1e-6);
  assert.ok(Math.abs(output[i] - before[i]) <= Math.abs(destination[i] - before[i]) * .12 + .0001,
    'first frame only advances a small fraction, never snaps to an endpoint');
}
// Retarget mid-flight, including reversal: use what is currently displayed.
for (const target of [middle, low, high, middle]) {
  before = output.slice();
  advanceArtifactPose(output, target, .73, 0);
  assert.deepEqual(output, before, 'retargeting without elapsed time preserves the rendered pose');
  for (let frame = 0; frame < 5; frame++) advanceArtifactPose(output, target, .73, 1 / 60);
  assert.equal(output, identity, 'the displayed buffer is retained');
}
for (const fps of [30, 60, 120]) {
  output.set(posed(low));
  let settled = false;
  for (let frame = 0; frame < fps * 3; frame++) settled = advanceArtifactPose(output, high, .73, 1 / fps);
  assert.ok(settled, 'transition reaches its exact final pose');
  assert.deepEqual(output, destination);
}
assert.deepEqual(high.positions, originalHigh, 'cached target geometry remains immutable');
assert.throws(() => advanceArtifactPose(new Float32Array(3), high, 1, .016), /topology/);
console.log('Rhythm transition: stable topology, continuous retargeting, bounded frames, convergence and immutable targets passed.');
