import type { ArtifactMesh } from "./superformula";

/** Retarget from the positions already on screen, never from a fresh sphere.
 * Fixed latitude resolution keeps each vertex paired across all rhythm values.
 * Returns true once the exact target has been reached. */
export function advanceArtifactPose(out: Float32Array, target: ArtifactMesh, morph: number, seconds: number, snap = false): boolean {
  if (out.length !== target.positions.length) throw new Error("Artifact pose topology changed");
  const m = Math.max(0, Math.min(1, morph));
  const growth = m * m * (3 - 2 * m);
  const alpha = snap ? 1 : 1 - Math.exp(-Math.max(0, Math.min(.05, seconds)) / .14);
  if (alpha === 0) return false;
  let remaining = 0;
  for (let i = 0; i < out.length; i++) {
    const destination = target.sphere[i] + (target.positions[i] - target.sphere[i]) * growth;
    const difference = destination - out[i];
    out[i] = Math.abs(difference) < .0001 ? destination : out[i] + difference * alpha;
    remaining = Math.max(remaining, Math.abs(destination - out[i]));
  }
  return remaining < .000001;
}
