import * as THREE from "three";

/** The pond's settled lens — shared by the water and anything placed on it. */
export const POND_LENS = { fov: 48, near: 0.1, far: 2400 } as const;
// A lower eye and a farther look point stretch the water toward an open horizon.
export const POND_CAMERA_HEIGHT = 2.35;
export const POND_CAMERA_Z = 10;
export const POND_LOOK = new THREE.Vector3(0, 0.05, -32);

/** The camera's way from standing at the pond to under it. */
export const POND_SINK = {
  /** Without a picture there is nothing to scroll past; the sink runs on its own. */
  durationMs: 2800,
  /** With a picture laid down, this much scrolling (in px) carries the eye under. */
  scrollPx: 1100,
  /** The surface is crossed here; the wash covers the moment itself. */
  washStart: 0.58,
  washFull: 0.9,
  reducedMs: 1,
} as const;

/** The light the eye passes through at the surface — water and air, not paper. */
export const SINK_WASH = "#e3eae9";
/** The light that takes the frame as the memory floats up to be named, and that the naming step opens from. */
export const SURFACE_LIGHT = "#f4f6f5";
/** How long the naming step takes to come out of that light. */
export const SURFACE_LIGHT_OUT_MS = 1000;

export interface PondSinkTarget { x: number; z: number }

const easeInOut = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/**
 * Where the pond camera stands for a given arrival (rising onto the stage)
 * and sink (going down through the water). Sinking leans the view onto the
 * spot the picture rests on, so the water fills the frame before it's crossed.
 */
export function pondCameraPose(
  arrival: number,
  sink: number,
  target: PondSinkTarget | null,
  position: THREE.Vector3,
  look: THREE.Vector3,
): void {
  const base = { x: 0, y: POND_CAMERA_HEIGHT - arrival * 0.15, z: POND_CAMERA_Z + (1 - arrival) * 0.4 };
  if (sink <= 0) {
    position.set(base.x, base.y, base.z);
    look.copy(POND_LOOK);
    return;
  }
  const s = easeInOut(sink);
  const at = target ?? { x: 0, z: 2 };
  // Drop, lean forward over the spot, pass through, keep going a little.
  position.set(
    base.x + (at.x * 0.5 - base.x) * s,
    base.y + (-0.55 - base.y) * s,
    base.z + (at.z + 2.6 - base.z) * s,
  );
  look.set(
    POND_LOOK.x + (at.x - POND_LOOK.x) * s,
    POND_LOOK.y + (-1.4 - POND_LOOK.y) * s,
    POND_LOOK.z + (at.z - 1.0 - POND_LOOK.z) * s,
  );
}

/** Opacity of the bright wash that carries the eye through the surface. */
export function pondSinkWash(sink: number): number {
  const t = (sink - POND_SINK.washStart) / (POND_SINK.washFull - POND_SINK.washStart);
  return easeInOut(t);
}
