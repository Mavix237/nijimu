/*
 * The landing's washes become flat cutouts of the gallery's vessels on the way
 * in (BlobScene + WatercolorField), and the cutouts grow into the vessels
 * themselves (PuddleDiveGallery). The two sides are separate trees, so they
 * meet here: during the ink entry the gallery writes where each memory's seat
 * will finally sit and, once its vessel has drawn a whole frame, that frame's
 * outline; the landing reads both every frame.
 */

/** Size of a cutout against its seat when it forms; it grows the rest of the way with the vessel. */
export const INK_CUT_SCALE = 0.5;

/** Mask resolution, per side: the outline at the vessel's own detail. */
const MASK_PX = 128;

export interface InkCutout {
  /** The seat's final centre, viewport px. */
  x: number;
  y: number;
  /** The seat box's final side, viewport px. */
  size: number;
  /** The seat's own depth fade. */
  opacity: number;
  /** The vessel's outline (white where it is, on transparent), or null until it has drawn. */
  mask: HTMLCanvasElement | null;
  /** Where the outline begins and ends down its box, 0…1 (the vessel fills only the middle of its seat). */
  span: [number, number] | null;
}

const seats = new Map<string, InkCutout>();

export function setInkSeat(id: string, place: Omit<InkCutout, "mask" | "span">) {
  const had = seats.get(id);
  seats.set(id, { ...place, mask: had?.mask ?? null, span: had?.span ?? null });
}

export function inkSeat(id: string): InkCutout | undefined {
  return seats.get(id);
}

/** Whether the gallery has placed any seats yet. */
export function hasInkSeats() {
  return seats.size > 0;
}

export function clearInkSeats() {
  seats.clear();
}

/**
 * Keeps the outline of a vessel's frame. Called right after the frame is drawn
 * (VesselArtifact's onReady), while the WebGL drawing buffer still holds it.
 */
export function captureInkMask(id: string, frame: HTMLCanvasElement) {
  const seat = seats.get(id);
  if (!seat || seat.mask) return;
  const mask = document.createElement("canvas");
  mask.width = mask.height = MASK_PX;
  const g = mask.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  try {
    g.drawImage(frame, 0, 0, MASK_PX, MASK_PX);
    const img = g.getImageData(0, 0, MASK_PX, MASK_PX);
    const d = img.data;
    let top = MASK_PX, bottom = -1;
    // clear glass is faint: anything the vessel covers counts as inside
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.min(1, Math.max(0, (d[i + 3] - 6) / 70));
      const v = Math.round(255 * a * a * (3 - 2 * a));
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
      if (v > 128) {
        const row = Math.floor(i / 4 / MASK_PX);
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
      }
    }
    softenMask(d);
    g.putImageData(img, 0, 0);
    seat.span = bottom >= top ? [top / MASK_PX, (bottom + 1) / MASK_PX] : null;
  } catch {
    return;
  }
  seat.mask = mask;
}

/** How far a mask's edge is softened, in mask px: the paint's own fringe finds its border in that ramp. */
const SOFTEN_PX = 3;

/** Two box passes each way over the grey mask, in place: near a Gaussian, so the border is a gentle slope, not a step. */
function softenMask(d: Uint8ClampedArray) {
  const n = MASK_PX;
  const a = new Float32Array(n * n), b = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) a[i] = d[i * 4];
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let sum = 0, count = 0;
        for (let k = -SOFTEN_PX; k <= SOFTEN_PX; k++) {
          const x = horizontal ? col + k : col, y = horizontal ? row : row + k;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          sum += from[y * n + x];
          count++;
        }
        to[row * n + col] = sum / count;
      }
    }
  };
  for (let round = 0; round < 2; round++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  for (let i = 0; i < n * n; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(a[i]);
}
