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
