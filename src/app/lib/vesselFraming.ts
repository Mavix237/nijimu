/** Maximum rendered diameter as a share of the gallery seat's original width,
 * before extra canvas room for spikes or a library size multiplier. */
export const GALLERY_VESSEL_MAX_WIDTH = 1;

export interface VesselFrame {
  distance: number;
  canvasScale: number;
  radius: number;
}

/** Preserve the established body framing and the extra canvas room used by
 * naming. The radius also supplies a rotation-independent gallery limit. */
export function frameVessel(positions: ArrayLike<number>, lookY: number, fov: number): VesselFrame {
  let halfHeight = 0.5;
  let radial = 0;
  let n = 0;
  let radius = 0.5;
  for (let k = 0; k < positions.length; k += 3) {
    const x = positions[k];
    const y = positions[k + 1] - lookY;
    const z = positions[k + 2];
    halfHeight = Math.max(halfHeight, Math.abs(y));
    radial += Math.hypot(x, z);
    n++;
    radius = Math.max(radius, Math.hypot(x, y, z));
  }
  const body = Math.max(halfHeight, (radial / Math.max(n, 1)) * 1.45);
  const reach = Math.max(body, radius);
  return {
    distance: (reach * 1.12) / Math.sin((fov / 2) * (Math.PI / 180)),
    canvasScale: reach / body,
    radius,
  };
}

/** Pull back only when needed. Fit the sphere's perspective silhouette, rather
 * than its diameter at the centre plane, which underestimates near-side points.
 * A fixed bound avoids scale pumping while dragging or hovering the vessel.
 * maxWidth is relative to the actual canvas (the caller removes canvas growth).
 * Bob shifts the orbit target vertically; reserve its worst camera-depth shift.
 */
export function cappedVesselDistance(
  frame: VesselFrame, fov: number, aspect: number, maxWidth?: number, bob = 0,
): number {
  if (maxWidth === undefined) return frame.distance;
  const halfWidth = Math.tan(fov * Math.PI / 360) * Math.max(aspect, 0.001) * Math.max(maxWidth, 0.001);
  const fitted = frame.radius * Math.hypot(1, 1 / halfWidth) / (1 - bob);
  return Math.max(frame.distance, fitted);
}
