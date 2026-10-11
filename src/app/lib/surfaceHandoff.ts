/** One in-memory frame bridges renderers at the water's surface. Never persisted. */
export interface SurfaceFrame { url: string; artifactOnly: boolean }
let pending: SurfaceFrame | null = null;
export function holdSurfaceFrame(canvas: HTMLCanvasElement | null, artifactOnly: boolean) {
  pending = null;
  if (!canvas) return;
  try { pending = { url: canvas.toDataURL("image/png"), artifactOnly }; }
  catch { /* A non-readable photo must not block navigation. */ }
}
export function takeSurfaceFrame(): SurfaceFrame | null {
  const frame = pending;
  pending = null;
  return frame;
}
