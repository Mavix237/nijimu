import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

/*
 * The hand-tracking camera, shown as if shot on film with a slow shutter.
 *
 * The video itself stays hidden (MediaPipe still reads it); what is seen is a
 * canvas. Every frame of the video is laid into an exposure that lets go of
 * what came before over SHUTTER_S, so a moving hand leaves a smear of itself.
 * The exposure is shown only FPS times a second — posterized in time, the
 * picture stepping rather than flowing — and each shown frame takes a fresh
 * grain, then is gradient-mapped (its brightness read off GRADIENT, black and
 * white with lifted blacks) and softly blurred.
 */

/** How long the exposure remembers, in seconds. */
const SHUTTER_S = 0.28;
/** Pictures shown per second. */
const FPS = 8;
/** Strength of the grain laid over each shown picture (overlay). */
const GRAIN = 0.2;
/** Grain clumps: the noise is drawn this many times coarser than the canvas, then smoothed up. */
const GRAIN_CLUMP = 1;
const GRAIN_TILES = 6;

/** The gradient map, dark to light: black and white, the blacks lifted so the
    darkest the picture goes is a soft charcoal, not black. */
const GRADIENT: [number, string][] = [
  [0, "#56565a"],
  [1, "#f2f2f2"],
];

/** GRADIENT as a 256-entry lookup, r g b per brightness. */
function gradientLut(): Uint8ClampedArray {
  const rgb = GRADIENT.map(([at, hex]) => [at, parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < rgb.length - 2 && t > rgb[k + 1][0]) k++;
    const [a0, ...c0] = rgb[k];
    const [a1, ...c1] = rgb[k + 1];
    const f = Math.min(1, Math.max(0, (t - a0) / (a1 - a0)));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
  }
  return lut;
}

function grainTiles(w: number, h: number): HTMLCanvasElement[] {
  const gw = Math.max(1, Math.round(w / GRAIN_CLUMP));
  const gh = Math.max(1, Math.round(h / GRAIN_CLUMP));
  return Array.from({ length: GRAIN_TILES }, () => {
    const small = document.createElement("canvas");
    small.width = gw;
    small.height = gh;
    const sctx = small.getContext("2d")!;
    const img = sctx.createImageData(gw, gh);
    for (let i = 0; i < img.data.length; i += 4) {
      // two uniforms summed: a softer, grain-like spread than flat noise
      const v = 128 + (Math.random() + Math.random() - 1) * 150;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const tile = document.createElement("canvas");
    tile.width = w;
    tile.height = h;
    const tctx = tile.getContext("2d")!;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(small, 0, 0, w, h);
    return tile;
  });
}

export function ShutterCamera({ video, active, style }: {
  video: RefObject<HTMLVideoElement | null>;
  /** Runs the exposure only while it is on screen. */
  active: boolean;
  style?: CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const out = canvas.current;
    if (!active || !out) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(out.clientWidth * dpr));
    const h = Math.max(1, Math.round(out.clientHeight * dpr));
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d", { willReadFrequently: true })!;
    const lut = gradientLut();
    const exposure = document.createElement("canvas");
    exposure.width = w;
    exposure.height = h;
    const ex = exposure.getContext("2d")!;
    const tiles = grainTiles(w, h);

    let raf = 0;
    let last = 0;
    let shown = -Infinity;
    let primed = false;
    let tile = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const v = video.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      // object-fit: cover
      const s = Math.max(w / v.videoWidth, h / v.videoHeight);
      const sw = w / s;
      const sh = h / s;
      const dt = primed ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      // the shutter: each frame adds itself in proportion to the time it covers
      ex.globalAlpha = primed ? 1 - Math.exp(-dt / SHUTTER_S) : 1;
      ex.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
      primed = true;

      if (now - shown < 1000 / FPS) return;
      shown = now;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(exposure, 0, 0);
      // never the same grain twice running
      tile = (tile + 1 + Math.floor(Math.random() * (GRAIN_TILES - 1))) % GRAIN_TILES;
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = GRAIN;
      ctx.drawImage(tiles[tile], 0, 0);
      // the gradient map: the grain goes in first so it takes the palette too
      const frame = ctx.getImageData(0, 0, w, h);
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = ((d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8) * 3;
        d[i] = lut[l];
        d[i + 1] = lut[l + 1];
        d[i + 2] = lut[l + 2];
      }
      ctx.putImageData(frame, 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, video]);

  return <canvas ref={canvas} aria-hidden style={style} />;
}
