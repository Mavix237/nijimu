import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/app/lib/cameraMotion.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });
const { cameraMotion, cameraMotionEase, cameraMotionLook } = module.exports;
const frame = (offset = 0, exposure = 0, noise = 0) => {
  const data = new Uint8ClampedArray(32 * 24 * 4);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    const value = (x >= 4 + offset && x < 12 + offset && y >= 4 && y < 20 ? 180 : 80) + exposure + ((x + y) % 2 ? noise : -noise);
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  return data;
};
assert.equal(cameraMotion(frame(), frame()), 0, 'a still frame stays clear');
assert.equal(cameraMotion(frame(), frame(0, 15)), 0, 'uniform auto-exposure does not trigger motion blur');
assert.equal(cameraMotion(frame(), frame(0, 0, 3)), 0, 'sensor noise stays below the motion threshold');
assert.equal(cameraMotion(frame(), frame(5)), 1, 'moving foreground reaches the existing blur');
assert.ok(cameraMotionLook(0).blur < cameraMotionLook(1).blur);
assert.ok(cameraMotionLook(0).shutter < cameraMotionLook(1).shutter);
assert.equal(cameraMotionLook(1).blur, .6);
assert.equal(cameraMotionLook(1).shutter, .28);
let motion = 0;
for (let i = 0; i < 12; i++) motion = cameraMotionEase(motion, 1, 1 / 60);
assert.ok(motion > .85, 'movement restores softness quickly');
const moving = motion;
motion = cameraMotionEase(motion, 0, 1 / 60);
assert.ok(motion > moving * .9, 'stopping does not abruptly snap sharp');
for (let i = 0; i < 90; i++) motion = cameraMotionEase(motion, 0, 1 / 60);
assert.ok(motion < .03, 'holding still settles to the clearer treatment');
console.log('Camera motion checks passed: stillness, movement, exposure, noise, original moving look and smooth settling.');
