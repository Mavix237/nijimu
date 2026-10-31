import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } });
  return module.exports;
}
const colors = load('../src/app/lib/colors.ts');
const { oklchToHex } = load('../src/app/lib/oklch.ts');
const { HOME_FIELD_STOPS, sampleHomePalette, uvFromHomePalette } = load('../src/app/lib/homePaletteField.ts', { './colors': colors });
HOME_FIELD_STOPS.forEach((id, index) => {
  const u = index / (HOME_FIELD_STOPS.length - 1);
  assert.ok(sampleHomePalette(u, 0).l > sampleHomePalette(u, 1).l, 'each region runs from light to deep');
  assert.ok(sampleHomePalette(u, 0).c > sampleHomePalette(u, 1).c * .7, 'lighter colours retain their hue strength');
  for (const v of [0, .25, .5, .75, 1]) {
    const color = sampleHomePalette(u, v);
    assert.ok(Object.values(color).every(Number.isFinite));
    assert.ok(color.l >= 0 && color.l <= 1 && color.c >= 0 && color.c < .12, 'field stays muted');
    const uv = uvFromHomePalette(color), restored = sampleHomePalette(uv.u, uv.v);
    assert.ok(Math.abs(color.l - restored.l) < .004, 'returning colour restores a close marker position');
  }
});
for (let i = 1; i < 100; i++) {
  const a = sampleHomePalette(i / 100, .499), b = sampleHomePalette(i / 100, .501);
  assert.ok(Math.abs(a.l - b.l) < .002, 'vertical selection remains continuous, without row boundaries');
}
assert.equal(oklchToHex(sampleHomePalette(-1, -1)), oklchToHex(sampleHomePalette(0, 0)));
assert.equal(oklchToHex(sampleHomePalette(2, 2)), oklchToHex(sampleHomePalette(1, 1)));
const purple = sampleHomePalette(HOME_FIELD_STOPS.indexOf('purple') / (HOME_FIELD_STOPS.length - 1), 1);
assert.ok(purple.h > 275 && purple.h < 315 && purple.c > .08, 'purple is distinct and sufficiently chromatic');
console.log('Homescreen field checks passed: distinct purple, colour strength, continuous muted gradients, restored selections and bounded input.');
