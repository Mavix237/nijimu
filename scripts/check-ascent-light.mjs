import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, require: id => {
    assert.ok(id in deps, id); return deps[id];
  } });
  return module.exports;
}
const sun = load('../src/app/lib/pondLight.ts');
const { ascentLightAt } = load('../src/app/lib/ascentLight.ts', { './pondLight': sun });
let previous = ascentLightAt(0);
assert.ok(Object.values(previous).every(value => value === 0));
for (let frame = 1; frame <= 390; frame++) {
  const next = ascentLightAt(frame / 390);
  for (const key of ['incident', 'radiance', 'bloom', 'exposure']) {
    assert.ok(next[key] >= previous[key], `${key} never flickers backwards during ascent`);
    assert.ok(Number.isFinite(next[key]));
  }
  assert.ok(next.incident - previous.incident < .012 && next.bloom - previous.bloom < .01, 'incident light and diffusion ramp smoothly');
  assert.ok(next.radiance - previous.radiance < .2 && next.exposure - previous.exposure < .02, 'no abrupt emission or exposure changes');
  previous = next;
}
assert.ok(ascentLightAt(.2).incident > 0 && ascentLightAt(.2).radiance > 0, 'surface light catches the glass first');
assert.equal(ascentLightAt(.2).bloom, 0, 'the first illumination precedes its spill');
assert.ok(ascentLightAt(.65).bloom > .5 && ascentLightAt(.65).radiance > 1, 'the luminous artifact spreads light before the final exposure');
assert.equal(ascentLightAt(.65).exposure, 0, 'scene details survive the middle of the ascent');
assert.equal(ascentLightAt(1).exposure, 1, 'full exposure meets the naming handoff');
for (const progress of [0, -1, NaN]) {
  assert.ok(Object.values(ascentLightAt(progress)).every(value => value === 0), 'rewind clears all illumination');
}
console.log('Ascent light checks passed: surface illumination → artifact radiance → bloom → final exposure, smooth timing and rewind.');
