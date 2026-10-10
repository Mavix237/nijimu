import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(path, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return module.exports;
}
const layout = load('../src/app/lib/carouselLayout.ts');
const field = load('../src/app/lab/vesselField.ts', { '../lib/carouselLayout': layout });
let previous = 0;
for (let i = 0; i <= 100; i++) {
  const depth = field.memoryDepth(i / 100);
  assert.ok(depth > previous, 'more blur always moves farther away');
  previous = depth;
}
assert.equal(field.memoryDepth(0), field.FIELD_FOCAL);
for (let i = 0; i < 32; i++) {
  assert.deepEqual(field.memoryFieldPlace(i), field.fieldPlace(i), 'unconfigured memories retain their placement');
  const original = field.fieldPlace(i);
  const far = field.memoryFieldPlace(i, 0);
  assert.ok(far.z > original.z * 3, 'full blur goes well beyond the reference constellation');
  assert.ok(Math.abs(far.sx * far.z - original.sx * original.z) < 1e-10, 'moving back preserves world x');
  for (const z of [field.DOLLY_MIN, 0, field.DOLLY_MAX]) {
    const seat = field.fieldSeat(far, { x: 0, y: 0, z }, { w: 1200, h: 800 });
    assert.equal(seat.opacity, 0, 'fully distant memory disappears even at maximum dolly');
    assert.ok(seat.size > 0 && Number.isFinite(seat.size));
  }
  const near = field.fieldSeat(field.memoryFieldPlace(i, 1), { x: 0, y: 0, z: 0 }, { w: 1200, h: 800 });
  assert.ok(near.opacity > .9);
  const following = field.memoryDepth(1) - field.FIELD_FOCAL;
  const passed = field.fieldSeat(original, { x: 0, y: 0, z: following }, { w: 1200, h: 800 });
  assert.equal(passed.opacity, 0, 'reference memories pass out of view when following the most distant memory');
  for (const haze of [0, .25, .5, 1]) {
    const chosen = field.memoryDepth(haze);
    const current = field.fieldSeat({ sx: 0, sy: 0, z: chosen }, { x: 0, y: 0, z: chosen - field.FIELD_FOCAL }, { w: 1200, h: 800 });
    assert.ok(Math.abs(current.scale - 1) < 1e-10, 'following the chosen memory keeps its apparent size constant');
  }
}
assert.equal(field.memoryDepth(-1), field.memoryDepth(0));
assert.equal(field.memoryDepth(2), field.memoryDepth(1));
for (const viewport of [{ w: 1280, h: 720 }, { w: 390, h: 844 }]) {
  const depths = Array.from({ length: 16 }, (_, i) => field.distancePreviewSeat(i, field.fieldPlace(i), field.FIELD_FOCAL, viewport).depth);
  const galleryDepths = Array.from({ length: 16 }, (_, i) => field.fieldPlace(i).z);
  assert.ok(Math.abs((Math.max(...depths) - Math.min(...depths)) / (Math.max(...galleryDepths) - Math.min(...galleryDepths)) - 2.8) < 1e-10, 'preview amplifies the gallery depth distribution');
  const midpoint = Array.from({ length: 16 }, (_, i) => field.distancePreviewSeat(i, field.fieldPlace(i), field.memoryDepth(.5), viewport));
  const visibleMiddle = midpoint.filter(s => s.opacity > .1 && s.x - s.size / 2 >= 0 && s.x + s.size / 2 <= viewport.w && s.y - s.size / 2 >= 0 && s.y + s.size / 2 <= viewport.h);
  assert.ok(visibleMiddle.length >= (viewport.w > viewport.h ? 4 : 2), 'several complete reference artifacts remain visible at the slider midpoint');
  for (let i = 0; i < 32; i++) {
    const place = field.memoryFieldPlace(i);
    const initial = field.distancePreviewSeat(i, place, field.memoryDepth(0), viewport);
    assert.ok(initial.depth >= 3, 'preview neighbours start well behind the handled artifact');
    const x = initial.x - viewport.w / 2;
    const y = initial.y - viewport.h / 2;
    assert.ok(Math.abs(x - place.sx * viewport.w) < 1e-8 || Math.abs(y - place.sy * viewport.h) < 1e-8, 'gallery coordinates are preserved; clearance moves at most one axis');
    assert.deepEqual(initial, field.distancePreviewSeat(i + 100, place, field.memoryDepth(0), viewport), 'memory indices never generate a replacement circular distribution');
    for (let step = 0; step <= 100; step++) {
      const seat = field.distancePreviewSeat(i, place, field.memoryDepth(step / 100), viewport);
      if (seat.opacity < .001) continue;
      const radius = Math.hypot(seat.x - viewport.w / 2, seat.y - viewport.h / 2);
      assert.ok(radius - seat.size / 2 > viewport.h * .22, 'neighbours leave the central artifact clear throughout the slider');
    }
    const end = field.distancePreviewSeat(i, place, field.memoryDepth(1), viewport);
    assert.equal(end.opacity, 0, 'the dispersed reference field still passes completely out of view');
  }
}
console.log('memory distance: monotonic depth, legacy placement, projection and far disappearance passed');
