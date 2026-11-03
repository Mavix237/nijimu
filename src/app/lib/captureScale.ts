/**
 * Screen-space grain is hashed from gl_FragCoord, so a larger buffer would
 * make it finer. Dividing by uCaptureScale keeps a grain the size it has on
 * screen. The uniform stays at 1 while nothing is exporting; 0 is treated as 1
 * so a material that never sets it does not change.
 */
export const CAPTURE_SCALE_GLSL = /* glsl */ `
uniform float uCaptureScale;
vec2 capturePx() { return gl_FragCoord.xy / max(uCaptureScale, 1.0); }
`;

/*
 * While a page is exported its pictures are drawn denser than on screen.
 * A canvas that sizes its own buffer listens here, takes the boost and draws
 * at once, so the screen never shows it cleared.
 */
let boost = 1;
const listeners = new Set<(boost: number) => void>();

export function captureBoost(): number {
  return boost;
}

export function setCaptureBoost(next: number) {
  if (next === boost) return;
  boost = next;
  for (const listener of listeners) listener(next);
}

export function onCaptureBoost(listener: (boost: number) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
