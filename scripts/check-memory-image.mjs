import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../src/app/lib/memoryImage.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { module, exports: module.exports, require: () => ({}) });
const { imageTextLines, surfaceTooth } = module.exports;

// the wall's tooth: static, zero-mean, faint
{
  const w = 400, h = 520;
  const tooth = surfaceTooth(w, h);
  assert.equal(tooth.length, w * h);
  assert.equal(surfaceTooth(w, h), tooth, 'kept per size');
  let sum = 0, sq = 0, max = 0;
  for (const v of tooth) { sum += v; sq += v * v; max = Math.max(max, Math.abs(v)); }
  const mean = sum / tooth.length, sd = Math.sqrt(sq / tooth.length - mean * mean);
  assert.ok(Math.abs(mean) < 1e-4, `zero mean (${mean})`);
  assert.ok(sd > .003 && sd < .006, `faint: σ ${sd.toFixed(4)} of lightness`);
  assert.ok(max < .03, `no pixel moved more than 3% (${max.toFixed(4)})`);
  console.log(`Wall tooth: σ ${(sd * 100).toFixed(2)}% (≈${(sd * 230).toFixed(2)} levels on the ground), max ${(max * 100).toFixed(2)}%.`);
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
