import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// Loaded as a real module, not in a vm context, so the timings mean what they say.
const file = join(mkdtempSync(join(tmpdir(), 'nijimu-grain-')), 'filmGrain.cjs');
writeFileSync(file, ts.transpileModule(readFileSync(new URL('../src/app/lib/filmGrain.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { GrainStudy, applyFilmGrain, grainSettingsOf, GRAIN_KINDS } = createRequire(import.meta.url)(file);

// The card's size, with a pale ground, a darker body and some fine detail.
const width = 1200, height = 1600;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const p = (y * width + x) * 4;
  const inBody = (x - 600) ** 2 + (y - 650) ** 2 < 380 ** 2;
  const base = inBody ? 70 + 120 * (y / height) + ((x >> 3) & 1) * 12 : 228 - 40 * (x / width);
  data[p] = base + 6; data[p + 1] = base; data[p + 2] = base - 4; data[p + 3] = 255;
}
const source = { width, height, data };
const sourceHash = createHash('sha1').update(data).digest('hex');
const hashOf = (pixels) => createHash('sha1').update(pixels.data).digest('hex');

const off = applyFilmGrain(source, { kind: 'off', intensity: .5, size: 1 });
assert.equal(hashOf(off), sourceHash, 'off is the source exactly');

const study = new GrainStudy(source);
const times = {};
for (const { kind } of GRAIN_KINDS.filter(k => k.kind !== 'off')) {
  const settings = { kind, intensity: .5, size: 1.2 };
  const t0 = performance.now();
  const first = study.render(settings);
  times[kind] = { first: Math.round(performance.now() - t0) };
  const t1 = performance.now();
  const again = study.render({ ...settings, intensity: .6 });
  times[kind].intensity = Math.round(performance.now() - t1);
  const fresh = applyFilmGrain(source, settings);
  assert.equal(hashOf(first), hashOf(fresh), `${kind}: the same grain every time, from a fresh study too`);
  assert.notEqual(hashOf(first), sourceHash, `${kind}: grain is applied`);
  assert.notEqual(hashOf(again), hashOf(first), `${kind}: intensity changes it`);

  // grain moves luminance; only the hybrid carries any colour noise
  let chroma = 0, delta = 0;
  for (let p = 0; p < data.length; p += 4 * 97) {
    const dr = first.data[p] - data[p], dg = first.data[p + 1] - data[p + 1], db = first.data[p + 2] - data[p + 2];
    delta += Math.abs(dg);
    chroma += Math.abs(dr - dg) + Math.abs(db - dg);
  }
  if (kind === 'hybrid') assert.ok(chroma < delta * .35, 'hybrid: colour noise stays minimal');
  else assert.ok(chroma < delta * .12, `${kind}: monochrome grain (rounding only)`);
}
assert.equal(createHash('sha1').update(data).digest('hex'), sourceHash, 'the source is never written to');

// the tonal response: more grain in the dark body than on the pale ground
const tonal = study.render({ kind: 'tonal', intensity: 1, size: 1 });
const spread = (x0, y0) => {
  let s = 0, n = 0;
  for (let y = y0; y < y0 + 40; y++) for (let x = x0; x < x0 + 40; x++) {
    const p = (y * width + x) * 4 + 1;
    s += (tonal.data[p] - data[p]) ** 2; n++;
  }
  return Math.sqrt(s / n);
};
assert.ok(spread(560, 500) > spread(60, 1500) * 1.5, 'tonal: midtones carry more grain than highlights');

// printed at 2×, the card's grain is the same pattern at the same size: each grain over its 2×2 px
{
  const w = 300, h = 400, flat = (s) => {
    const d = new Uint8ClampedArray(w * s * h * s * 4);
    for (let p = 0; p < d.length; p += 4) { d[p] = 186; d[p + 1] = 180; d[p + 2] = 176; d[p + 3] = 255; }
    return { width: w * s, height: h * s, data: d };
  };
  const card = { kind: 'tonal', intensity: .2, size: .5 };
  const one = new GrainStudy(flat(1)).render(card);
  const two = new GrainStudy(flat(2)).render(card, undefined, 2);
  for (let y = 0; y < 2 * h; y++) for (let x = 0; x < 2 * w; x++) {
    const p = (y * 2 * w + x) * 4, q = ((y >> 1) * w + (x >> 1)) * 4;
    if (two.data[p + 1] !== one.data[q + 1]) assert.fail(`grain at 2× differs from the card's at ${x},${y}`);
  }
}

assert.deepEqual({ ...grainSettingsOf({ kind: 'nope', intensity: 9, size: -1 }) }, { kind: 'off', intensity: 1, size: .5 }, 'settings are clamped');
console.log('Film grain checks passed: deterministic, source untouched, off exact, monochrome, tonal response.');
console.log('ms at 1200×1600 (first render / intensity change):', JSON.stringify(times));
