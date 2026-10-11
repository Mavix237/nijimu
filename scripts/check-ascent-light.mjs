import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

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
const { ascentLightAt, surfaceReturnBlurAt } = load('../src/app/lib/ascentLight.ts', { './pondLight': sun });
let previous = ascentLightAt(0);
assert.ok(Object.values(previous).every(value => value === 0));
for (let frame = 1; frame <= 390; frame++) {
  const next = ascentLightAt(frame / 390);
  for (const key of ['incident', 'shafts', 'radiance', 'atmosphere', 'blur', 'ray', 'rayFill', 'bloom', 'exposure', 'handoff']) {
    assert.ok(next[key] >= previous[key], `${key} never flickers backwards during ascent`);
    assert.ok(Number.isFinite(next[key]));
  }
  assert.ok(next.incident - previous.incident < .012 && next.bloom - previous.bloom < .015, 'incident light and diffusion ramp smoothly');
  assert.ok(next.radiance - previous.radiance < .35 && next.exposure - previous.exposure < .035, 'no abrupt emission or exposure changes');
  assert.ok(next.blur - previous.blur < .32 && next.blur <= 12, 'light diffusion grows smoothly and stays bounded');
  previous = next;
}
assert.ok(ascentLightAt(.01).shafts < .002, 'atmospheric entrance begins with nearly zero velocity');
assert.equal(ascentLightAt(.4).shafts, 1, 'atmospheric entrance completes before the artifact lights');
assert.ok(ascentLightAt(.2).incident > 0, 'the water receives surface light first');
assert.equal(ascentLightAt(.5).radiance, 0, 'the artifact stays unlit through the first half of the climb');
assert.ok(ascentLightAt(.6).radiance > 0 && ascentLightAt(.6).radiance < .02, 'artifact light begins gently');
assert.equal(ascentLightAt(.6).bloom, 0, 'light gathers before it diffuses');
assert.ok(ascentLightAt(.8).radiance < .3 && ascentLightAt(.95).radiance > .4, 'strong emission waits until close to the surface');
assert.equal(ascentLightAt(1).radiance, .7, 'the vessel peak is reduced to avoid an overbright source');
assert.equal(ascentLightAt(.22).atmosphere, 0, 'the opening frame retains its original atmosphere');
assert.ok(ascentLightAt(.5).atmosphere > .05 && ascentLightAt(.5).atmosphere < .1,
  'a restrained atmospheric lift precedes the artifact light');
assert.equal(ascentLightAt(.58).blur, 0, 'the initial interior ray stays focused');
assert.ok(ascentLightAt(.8).blur > 4, 'the artifact softens as its glow grows');
assert.equal(ascentLightAt(.98).blur, 12, 'the silhouette is fully softened before the handoff');
assert.ok(ascentLightAt(.8).atmosphere > .2, 'surrounding water brightens before the final exposure');
assert.equal(ascentLightAt(1).atmosphere, .55, 'the atmosphere builds alongside the artifact at reduced intensity');
assert.equal(ascentLightAt(.52).ray, 0, 'the interior ray respects the delayed start');
assert.ok(ascentLightAt(.66).ray > .99 && ascentLightAt(.66).radiance < .04,
  'the contained ray establishes itself before the broad vessel glow');
assert.equal(ascentLightAt(.84).rayFill, 1, 'light fills the interior before the final wash');
for (const progress of [.82, .9, .98, 1]) {
  assert.equal(ascentLightAt(progress).ray, 1, 'the ray holds its brightness until the surface handoff');
}
assert.ok(ascentLightAt(.9).radiance - ascentLightAt(.85).radiance > ascentLightAt(.7).radiance - ascentLightAt(.65).radiance,
  'the glow accelerates late rather than rising at a constant rate');
assert.equal(ascentLightAt(.52).exposure, 0, 'the atmospheric wash starts with the artifact light');
assert.ok(ascentLightAt(.65).exposure > 0, 'the wash is present during the artifact illumination');
assert.equal(ascentLightAt(.96).handoff, 0, 'the water hue is retained until the surface handoff');
assert.equal(ascentLightAt(1).handoff, 1, 'the endpoint matches the naming background');
assert.equal(ascentLightAt(1).exposure, 1, 'full exposure meets the naming handoff');
for (const progress of [0, -1, NaN]) {
  assert.ok(Object.values(ascentLightAt(progress)).every(value => value === 0), 'rewind clears all illumination');
}
let previousBlur = 0;
for (let frame = 0; frame <= 168; frame++) {
  const blur = surfaceReturnBlurAt(frame / 168);
  assert.ok(blur >= previousBlur && blur <= 22 && blur - previousBlur < 1.23, 'underwater blur grows smoothly and stays bounded');
  previousBlur = blur;
}
assert.equal(surfaceReturnBlurAt(.74), 0, 'glass stays sharp through the surface crossing');
assert.ok(surfaceReturnBlurAt(.8) > 0, 'blur begins once underwater');
assert.equal(surfaceReturnBlurAt(.9), 22, 'the artifact softens as the underwater wash conceals it');
const { pondCameraPose } = load('../src/app/lib/pondCamera.ts', { three: THREE });
const position = new THREE.Vector3(), look = new THREE.Vector3();
for (let frame = 0; frame <= 168; frame++) {
  const sink = frame / 168;
  pondCameraPose(1, sink, null, position, look);
  if (surfaceReturnBlurAt(sink) > 0) assert.ok(position.y < 0, 'return blur never starts above the physical water surface');
}
assert.equal(surfaceReturnBlurAt(0), 0, 'returning to rest restores sharpness');
assert.equal(surfaceReturnBlurAt(NaN), 0);
console.log('Surface transition checks passed: late accelerating artifact glow, final exposure, smooth return blur and reset.');
