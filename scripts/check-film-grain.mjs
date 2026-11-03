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

assert.deepEqual({ ...grainSettingsOf({ kind: 'nope', intensity: 9, size: -1 }) }, { kind: 'off', intensity: 1, size: .5 }, 'settings are clamped');

// At 2× the tonal field is the 1× field held over 2×2 pixels, so scaling back does not change it.
{
  const settings = { kind: 'tonal', intensity: .2, size: .5 };
  const flat = (w, h, v) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
    return { width: w, height: h, data };
  };
  const sigmaOf = (pixels) => {
    let s = 0, q = 0, n = 0;
    for (let i = 1; i < pixels.data.length; i += 4) { s += pixels.data[i]; q += pixels.data[i] ** 2; n++; }
    const mean = s / n;
    return Math.sqrt(q / n - mean * mean);
  };
  const w = 160, h = 120;
  for (const value of [232, 96]) {
    const one = new GrainStudy(flat(w, h, value)).render(settings);
    const two = new GrainStudy(flat(w * 2, h * 2, value)).render(settings, undefined, 2);
    for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) {
      const block = two.data[(y * w * 2 + x) * 4 + 1];
      const origin = two.data[((y & ~1) * w * 2 + (x & ~1)) * 4 + 1];
      assert.equal(block, origin, 'each grain covers its 2×2');
      assert.equal(block, one.data[(((y >> 1) * w) + (x >> 1)) * 4 + 1], '2× scaled back is the 1× grain');
    }
    const down = flat(w, h, 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4 + 1;
      down.data[p] = two.data[(y * 2 * w * 2 + x * 2) * 4 + 1];
    }
    assert.ok(Math.abs(sigmaOf(down) - sigmaOf(one)) < 1e-6, `σ holds from 2× back to 1× at value ${value}`);
  }
}
console.log('Film grain checks passed: deterministic, source untouched, off exact, monochrome, tonal response.');
console.log('ms at 1200×1600 (first render / intensity change):', JSON.stringify(times));
