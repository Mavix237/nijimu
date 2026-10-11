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
  assert.ok(Math.abs((Math.max(...depths) - Math.min(...depths)) / (Math.max(...galleryDepths) - Math.min(...galleryDepths)) - 4.4) < 1e-10, 'preview amplifies the gallery depth distribution');
  const midpoint = Array.from({ length: 16 }, (_, i) => field.distancePreviewSeat(i, field.fieldPlace(i), field.memoryDepth(.5), viewport));
  const visibleMiddle = midpoint.filter(s => s.opacity > .1 && s.x - s.size / 2 >= 0 && s.x + s.size / 2 <= viewport.w && s.y - s.size / 2 >= 0 && s.y + s.size / 2 <= viewport.h);
  assert.ok(visibleMiddle.length >= (viewport.w > viewport.h ? 4 : 2), 'several complete reference artifacts remain visible at the slider midpoint');
  const beyondMiddle = Array.from({ length: 16 }, (_, i) => field.distancePreviewSeat(i, field.fieldPlace(i), field.memoryDepth(.7), viewport));
  assert.ok(beyondMiddle.filter(s => s.opacity > .1 && s.x - s.size / 2 >= 0 && s.x + s.size / 2 <= viewport.w && s.y - s.size / 2 >= 0 && s.y + s.size / 2 <= viewport.h).length >= 4,
    'deeper reference artifacts remain fully visible at 70% distance');
  for (let i = 0; i < 32; i++) {
    const place = field.memoryFieldPlace(i);
    const initial = field.distancePreviewSeat(i, place, field.memoryDepth(0), viewport);
    assert.ok(initial.depth >= 3, 'preview neighbours start well behind the handled artifact');
    const oldSize = layout.carouselFrame(viewport.w, viewport.h).size * field.FIELD_FOCAL / (2.4 + place.z * 2.8);
    assert.ok(Math.abs(initial.size / oldSize - 1.15) < 1e-10, 'deeper seats still appear slightly larger at the start');
    const x = initial.x - viewport.w / 2;
    const y = initial.y - viewport.h / 2;
    assert.ok(Math.abs(x - place.sx * viewport.w) < 1e-8 || Math.abs(y - place.sy * viewport.h) < 1e-8, 'gallery coordinates are preserved; clearance moves at most one axis');
    assert.deepEqual(initial, field.distancePreviewSeat(i + 100, place, field.memoryDepth(0), viewport), 'memory indices never generate a replacement circular distribution');
    for (let step = 0; step <= 100; step++) {
      const seat = field.distancePreviewSeat(i, place, field.memoryDepth(step / 100), viewport);
      if (seat.opacity < .001) continue;
      assert.ok(Math.abs(seat.size * Math.max(.3, seat.depth) - initial.size * initial.depth) < 1e-8,
        'slider changes perspective without scaling the reference meshes');
      const radius = Math.hypot(seat.x - viewport.w / 2, seat.y - viewport.h / 2);
      assert.ok(radius - seat.size / 2 > viewport.h * .22, 'neighbours leave the central artifact clear throughout the slider');
    }
    const end = field.distancePreviewSeat(i, place, field.memoryDepth(1), viewport);
    assert.equal(end.opacity, 0, 'the dispersed reference field still passes completely out of view');
  }
}
const gesture = load('../src/app/lib/memoryDistanceGesture.ts');
// Foreground type can wrap differently by viewport. Clear its measured bounds
// using each vessel's whole silhouette, while retaining a stable world seat.
for (const viewport of [{ w: 1253, h: 1056 }, { w: 1280, h: 720 }, { w: 390, h: 844 }]) {
  const width = Math.min(540, viewport.w - 40);
  const bounds = { left: (viewport.w - width) / 2, right: (viewport.w + width) / 2, top: 132, bottom: viewport.w < 600 ? 370 : 290 };
  for (const radiusRatio of [.5, .8, 1.2]) for (let i = 0; i < 32; i++) {
    const place = field.fieldPlace(i);
    const foreground = { bounds, shift: .01, radiusRatio };
    const seat = field.distancePreviewSeat(i, place, field.FIELD_FOCAL, viewport, foreground);
    const radius = seat.size * radiusRatio;
    const y = seat.y + viewport.h * foreground.shift;
    assert.ok(seat.x + radius < bounds.left || seat.x - radius > bounds.right || y + radius < bounds.top || y - radius > bounds.bottom,
      'starting silhouettes never overlap foreground text, including wide forms and wrapped mobile copy');
    const midway = field.distancePreviewSeat(i, place, field.memoryDepth(.5), viewport, foreground);
    assert.ok(Math.abs((midway.x - viewport.w / 2) * midway.depth - (seat.x - viewport.w / 2) * seat.depth) < 1e-8,
      'text avoidance keeps world positions fixed during depth travel');
    assert.equal(seat.size, field.distancePreviewSeat(i, place, field.FIELD_FOCAL, viewport).size,
      'text clearance never shrinks the artifact');
  }
}
// A face-on, open hand in height-normalized camera coordinates. Transforming
// the whole hand models forward/back travel without changing finger spread.
function palm(scale = 1, aspect = 1, rotation = 0, mirror = 1) {
  const points = Array.from({ length: 21 }, () => [0, 0]);
  points[0] = [0, .12];
  for (const [mcp, x, y] of [[5, -.065, 0], [9, -.02, -.02], [13, .025, -.01], [17, .065, .015]]) {
    points[mcp] = [x, y];
    points[mcp + 1] = [x, y - .055];
    points[mcp + 2] = [x, y - .09];
    points[mcp + 3] = [x, y - .13];
  }
  return points.map(([x, y]) => ({
    x: .5 + mirror * scale * (x * Math.cos(rotation) - y * Math.sin(rotation)) / aspect,
    y: .5 + scale * (x * Math.sin(rotation) + y * Math.cos(rotation)),
  }));
}
const base = gesture.openPalmSize(palm());
for (const aspect of [1, 4 / 3, 16 / 9]) {
  for (const rotation of [0, .6, -1]) {
    for (const mirror of [-1, 1]) {
      assert.ok(Math.abs(gesture.openPalmSize(palm(1, aspect, rotation, mirror), aspect) - base) < 1e-10,
        'palm measurement is independent of aspect, roll and mirror');
    }
  }
}
assert.ok(Math.abs(gesture.openPalmSize(palm(1.6)) / base - 1.6) < 1e-10);
const spread = palm();
for (const tip of [8, 12, 16, 20]) spread[tip].x += (tip < 14 ? -.03 : .03);
assert.equal(gesture.openPalmSize(spread), base, 'finger spread does not drive distance');
const fist = palm();
for (const tip of [8, 12, 16, 20]) fist[tip] = { ...fist[tip - 3] };
const edgeOn = palm().map(p => ({ x: .5 + (p.x - .5) * .1, y: p.y }));
const corrupt = palm(); corrupt[9].x = NaN;
for (const hand of [undefined, [], fist, edgeOn, corrupt, palm(.05), palm(10)]) {
  assert.equal(gesture.openPalmSize(hand), null, 'invalid, folded, clipped or edge-on hands hold the setting');
}
const push = gesture.createDistancePush();
let value = .25, time = 0;
const frame = hand => {
  const next = push.update(hand, 1, time += 33, value);
  if (next !== null) value = next;
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  return next;
};
assert.equal(frame(palm()), null, 'acquisition preserves the current value');
for (let i = 0; i < 90; i++) frame(palm(1 + Math.sin(i) * .001));
assert.equal(value, .25, 'stationary landmark jitter is ignored');
for (let i = 1; i <= 60; i++) {
  const before = value;
  frame(palm(1 + i / 60 * .65));
  assert.ok(value >= before, 'pushing closer increases distance and blur');
  assert.ok(value - before < .05, 'smoothing avoids large jumps');
}
for (let i = 0; i < 40; i++) frame(palm(1.65));
assert.equal(value, 1, 'a comfortable push reaches full blur');
for (let i = 0; i < 20; i++) frame(palm(1.45));
assert.ok(value < .8, 'pulling back reverses after reaching the limit');
for (let i = 1; i <= 60; i++) {
  const before = value;
  frame(palm(1.45 - i / 60 * .65));
  assert.ok(value <= before, 'pulling back brings the artifact closer and clearer');
}
for (let i = 0; i < 40; i++) frame(palm(.8));
assert.equal(value, 0, 'pulling back reaches clear');
value = .63;
frame(undefined);
assert.equal(frame(palm(1.8)), null, 'reacquisition at a different depth cannot jump');
for (let i = 0; i < 20; i++) frame(palm(1.8));
assert.equal(value, .63);
frame(fist);
assert.equal(frame(palm(.7)), null, 'reopening anchors at the current setting');
assert.equal(value, .63);
push.reset();
assert.equal(frame(palm(1.2)), null, 'changing steps resets calibration');
assert.equal(value, .63);
console.log('memory distance: depth, projection, disappearance and palm-push gesture checks passed');
