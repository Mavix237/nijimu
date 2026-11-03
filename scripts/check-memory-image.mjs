import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../src/app/lib/memoryImage.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { module, exports: module.exports, require: () => ({}) });
const { imageTextLines, surfaceTooth, surfaceGrain, surfaceSettingsOf, SURFACE_DEFAULT, SURFACE_RANGE } = module.exports;

// the wall's tooth and grain: static, zero mean, unit σ (the strengths are applied when worn)
{
  const w = 400, h = 520;
  const stats = (field) => {
    let sum = 0, sq = 0, max = 0;
    for (const v of field) { sum += v; sq += v * v; max = Math.max(max, Math.abs(v)); }
    const mean = sum / field.length;
    return { mean, sd: Math.sqrt(sq / field.length - mean * mean), max };
  };
  for (const size of [1, 2.5]) {
    const tooth = surfaceTooth(w, h, size);
    assert.equal(tooth.length, w * h);
    assert.equal(surfaceTooth(w, h, size), tooth, 'kept per size');
    const s = stats(tooth);
    assert.ok(Math.abs(s.mean) < 1e-4 && Math.abs(s.sd - 1) < 1e-3, `tooth at size ${size}: zero mean, unit σ`);
  }
  const g = stats(surfaceGrain(w, h));
  assert.ok(Math.abs(g.mean) < .01 && Math.abs(g.sd - 1) < .01 && g.max <= Math.sqrt(6) + 1e-6, 'grain: zero mean, unit σ, bounded');
  assert.deepEqual({ ...surfaceSettingsOf(undefined) }, { ...SURFACE_DEFAULT });
  const wild = surfaceSettingsOf({ density: 99, densitySize: -1, tooth: 'x', toothSize: 2, grain: -3 });
  assert.equal(wild.density, SURFACE_RANGE.density.max);
  assert.equal(wild.densitySize, SURFACE_RANGE.densitySize.min);
  assert.equal(wild.tooth, SURFACE_DEFAULT.tooth);
  assert.equal(wild.toothSize, 2);
  assert.equal(wild.grain, 0);
  console.log('Wall tooth and grain checks passed: static, zero mean, unit σ; settings clamped.');
}
const measure = text => Array.from(text).length;
for (const text of [
  'A memory with enough words to wrap onto several lines.',
  'one\n\ntwo\nthree',
  '一段很长的回忆没有空格也应该完整地保留在下载的图片里',
  'word '.repeat(4000),
  'https://example.com/' + 'a'.repeat(200),
  'a 🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊 memory',
]) {
  const lines = imageTextLines(text, 16, measure, true);
  assert.ok(lines.every(line => measure(line) <= 16), 'every line fits the image');
  assert.equal(lines.join('').replace(/\s/g, ''), text.replace(/\s/g, ''), 'the full transcript is retained');
}
assert.deepEqual(Array.from(imageTextLines('one\n\ntwo', 16, measure)), ['one', '', 'two']);
assert.deepEqual(Array.from(imageTextLines('', 16, measure)), ['']);
const widowText = 'one two three four five six seven';
const balanced = imageTextLines(widowText, 28, measure, true);
assert.equal(balanced.length, 2, 'balancing does not add a line');
assert.ok(balanced.every(line => line.split(' ').length >= 2), 'no stranded word at paragraph end');
assert.ok(balanced.every(line => measure(line) >= 28 * .35), 'the final lines have a substantial measure');
assert.equal(balanced.join(' '), widowText, 'balancing keeps word boundaries and order');
console.log('Memory image text checks passed: paragraphs, long transcripts, CJK, emoji and long tokens.');
