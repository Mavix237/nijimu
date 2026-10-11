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

const { createGestureHold, GESTURE_HOLD } = load('../src/app/lib/gestureHold.ts');
const { stillBand, stillMs, breakBand, breakMs } = GESTURE_HOLD;

const hold = createGestureHold();
let value = 0.4;
let t = 0;
const feed = (proposed, dt = 33) => {
  t += dt;
  const next = hold.update(proposed, t, value);
  if (next.apply !== null) value = next.apply;
  return next;
};

assert.equal(feed(0.9).apply, null, 'first frame only primes, no jump');
assert.equal(value, 0.4);

for (let i = 0; i < 8; i++) feed(0.4 + (i % 2) * 0.01);
assert.equal(hold.engaged, false, 'idle tremor before any edit never locks');
assert.equal(value, 0.4);

for (let i = 1; i <= 12; i++) feed(0.4 + i * 0.03);
assert.ok(value > 0.55, 'a clear sweep writes the form');
assert.equal(hold.engaged, false, 'continuous travel does not lock');

const settled = value;
for (let i = 0; i < Math.ceil(stillMs / 33) + 2; i++) {
  feed(settled + (i % 2 ? 0.008 : -0.006));
}
assert.equal(hold.engaged, true, 'holding inside the still band locks');
assert.ok(feed(settled + stillBand * 0.6).apply === null, 'small drift after lock is ignored');
assert.equal(value, settled);

const twitch = feed(settled + breakBand + 0.02, 16);
assert.equal(twitch.apply, null, 'a single large twitch does not unlock');
assert.equal(hold.engaged, true);

for (let i = 0; i < Math.ceil(300 / 33); i++) feed(settled + breakBand + 0.04);
assert.equal(hold.engaged, true, 'a short leave — a hand dropping — stays locked');
assert.equal(value, settled);

for (let i = 0; i < Math.ceil(breakMs / 33) + 1; i++) feed(settled + breakBand + 0.04);
assert.equal(hold.engaged, false, 'a sustained move unlocks');
assert.ok(value > settled, 'the new intent writes after the break');

hold.reset();
value = 0.2;
t = 0;
feed(0.2);
for (let i = 1; i <= 10; i++) feed(0.2 + i * 0.04);
for (let i = 0; i < Math.ceil(stillMs / 33) + 2; i++) feed(value);
assert.equal(hold.engaged, true);
hold.sync(0.75);
assert.equal(hold.held, 0.75, 'a slider edit moves the held value');
const lockedAt = value;
assert.equal(feed(lockedAt + 0.02).apply, null);
assert.equal(value, lockedAt, 'sync does not invent a gesture write');
assert.equal(feed(0.75 + 0.03).apply, null, 'small motion around the new hold is ignored');

console.log('gesture hold: prime, still-lock, ignore tremor, break on intent passed');
