import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";

function load(path) {
  const module = { exports: {} };
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}
const { frameVessel, cappedVesselDistance, GALLERY_VESSEL_MAX_WIDTH: cap } = load("../src/app/lib/vesselFraming.ts");
const { ARTIFACT_CATEGORIES, baseForm, buildArtifactMesh } = load("../src/app/lib/superformula.ts");
const FOV = 18, LOOK_Y = -0.05, BOB = 0.004;
const sphere = buildArtifactMesh(baseForm("sphere"), undefined, 0.25).positions;
const roundFrame = frameVessel(sphere, LOOK_Y, FOV);
assert.equal(cappedVesselDistance(roundFrame, FOV, 1, cap, BOB), roundFrame.distance,
  "ordinary round vessels retain their established size");

// A small body with outlying tips used to enlarge its canvas without a limit.
const spiky = Float32Array.from([...sphere, -8, LOOK_Y, 0, 8, LOOK_Y, 0]);
const spikeFrame = frameVessel(spiky, LOOK_Y, FOV);
assert.ok(spikeFrame.canvasScale > 4, "fixture reproduces unbounded canvas growth");
assert.ok(cappedVesselDistance(spikeFrame, FOV, 1, cap / spikeFrame.canvasScale, BOB) > spikeFrame.distance);

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
const point = new THREE.Vector3();
let checked = 0;
const shapes = [spiky, ...ARTIFACT_CATEGORIES.map(category => buildArtifactMesh(baseForm(category), undefined, 0.25).positions)];
for (const positions of shapes) {
  const frame = frameVessel(positions, LOOK_Y, FOV);
  assert.equal(cappedVesselDistance(frame, FOV, 0.5), frame.distance,
    "uncapped consumers, including naming and shape previews, preserve their framing");
  for (const aspect of [0.5, 1, 2]) for (const librarySize of [0.6, 1, 1.5, 3]) {
    const room = frame.canvasScale * librarySize;
    const distance = cappedVesselDistance(frame, FOV, aspect, cap / room, BOB);
    assert.ok(Number.isFinite(distance) && distance >= frame.distance);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    for (const pitchDegrees of [-35, 4, 85]) for (const yaw of [0, 0.7, 1.6, 3.3]) {
      const pitch = pitchDegrees * Math.PI / 180;
      for (const bob of [-BOB, BOB]) {
        const targetY = LOOK_Y - distance * bob;
        camera.position.set(-Math.sin(yaw) * Math.cos(pitch) * distance,
          targetY + Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance);
        camera.lookAt(0, targetY, 0);
        camera.updateMatrixWorld();
        let widest = 0;
        for (let i = 0; i < positions.length; i += 3) {
          point.set(positions[i], positions[i + 1], positions[i + 2]).project(camera);
          widest = Math.max(widest, Math.abs(point.x) * room);
          checked++;
        }
        assert.ok(widest <= cap + 1e-6,
          `point exceeds ${cap * 100}% of the original viewport (aspect ${aspect}, library size ${librarySize})`);
      }
    }
  }
}
console.log(`Vessel framing checks passed: ${checked} projected vertices; wide tips, all form families, portrait/landscape, library sizes, rotation and hover stay within ${cap * 100}%.`);
