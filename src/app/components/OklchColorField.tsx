import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPaletteWater, type PaletteWater } from "../lib/paletteWater";
import { Oklch, oklchToHex, sampleField } from "../lib/oklch";
import { useCompact } from "../hooks/useCompact";

const COLS = 196;
const ROWS = 72;

/** Visible wash height at the centre of its curved edge. */
export const WASH_HEIGHT = "25vh";
export const WASH_MIN_PX = 134;
const MASK_HEIGHT = 512;
const MASK_EDGE_Y = 108;
const MASK_CONTROL_Y = 268;
// At t=.5 the cubic edge sits at .25*end + .75*control. Size the
// drawing area to leave 25vh of colour below that edge, after masking.
const VISIBLE_HEIGHT_RATIO = 1 - (MASK_EDGE_Y * .25 + MASK_CONTROL_Y * .75) / MASK_HEIGHT;

/**
 * Bowl contour with the dissolve baked in: fill the curve, then blur
 * it so the edge melts along the shape (not a flat horizontal cut).
 */
function bakeCurveMask(): string {
  if (typeof document === "undefined") return "none";
  const w = 1024;
  const h = MASK_HEIGHT;
  const endY = MASK_EDGE_Y;
  const midY = MASK_CONTROL_Y;
  const shape = document.createElement("canvas");
  shape.width = w;
  shape.height = h;
  const s = shape.getContext("2d");
  if (!s) return "none";
  s.fillStyle = "#fff";
  s.beginPath();
  s.moveTo(0, endY);
  s.bezierCurveTo(w * 0.22, midY, w * 0.78, midY, w, endY);
  s.lineTo(w, h);
  s.lineTo(0, h);
  s.closePath();
  s.fill();

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "none";
  ctx.filter = "blur(42px)";
  ctx.drawImage(shape, 0, 0);
  return `url(${canvas.toDataURL("image/png")})`;
}

/** Whether a 2D canvas honours `filter` (Safari ships it disabled, and then
    the baked mask above has a hard edge). */
function canvasBlurWorks(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  c.width = 9;
  c.height = 9;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.filter = "blur(2px)";
  ctx.fillRect(4, 4, 1, 1);
  return ctx.getImageData(1, 4, 1, 1).data[3] > 0;
}

/** The normal distribution's CDF: how much of a Gaussian-blurred straight edge is on at distance `d`. */
function gaussEdge(d: number, sigma: number): number {
  const x = d / (sigma * Math.SQRT2);
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (x < 0 ? -erf : erf));
}

type MaskShape = {
  w: number;
  h: number;
  /** The curve's height at both ends, and its control height (the same cubic as bakeCurveMask). */
  endY: number;
  controlY: number;
  /** The blur across the curve, at the sides, and at the foot, in mask pixels (0 for no fade there). */
  edge: number;
  sides: number;
  foot: number;
};

/**
 * The same bowl, softened by computing each pixel's distance from the curve
 * rather than with a canvas filter, so it is blurred in every browser.
 */
function computeCurveMask({ w, h, endY, controlY, edge, sides, foot }: MaskShape): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "none";
  // the curve's height and slope per column, from the cubic sampled densely
  const curveY = new Float32Array(w);
  const slope = new Float32Array(w);
  const N = w * 4;
  let prevX = 0;
  let prevY = endY;
  let col = 0;
  for (let i = 1; i <= N && col < w; i++) {
    const t = i / N;
    const a = 3 * (1 - t) * (1 - t) * t;
    const b = 3 * (1 - t) * t * t;
    const x = a * 0.22 * w + b * 0.78 * w + t * t * t * w;
    const y = (1 - t) ** 3 * endY + (a + b) * controlY + t * t * t * endY;
    while (col < w && col + 0.5 <= x) {
      const f = x > prevX ? (col + 0.5 - prevX) / (x - prevX) : 0;
      curveY[col] = prevY + (y - prevY) * f;
      slope[col] = x > prevX ? (y - prevY) / (x - prevX) : 0;
      col++;
    }
    prevX = x;
    prevY = y;
  }
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let x = 0; x < w; x++) {
    const across = 1 / Math.sqrt(1 + slope[x] * slope[x]);
    const side = sides > 0 ? gaussEdge(x + 0.5, sides) * gaussEdge(w - x - 0.5, sides) : 1;
    for (let y = 0; y < h; y++) {
      const footFade = foot > 0 ? gaussEdge(h - y - 0.5, foot) : 1;
      const a = gaussEdge((y + 0.5 - curveY[x]) * across, edge) * side * footFade;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return `url(${canvas.toDataURL("image/png")})`;
}

const CURVE_MASK = canvasBlurWorks()
  ? bakeCurveMask()
  : computeCurveMask({ w: 1024, h: MASK_HEIGHT, endY: MASK_EDGE_Y, controlY: MASK_CONTROL_Y, edge: 42, sides: 42, foot: 42 });

/** On a phone the bowl is baked at the wash's own size (half resolution), so a
    narrow screen does not squeeze it into a deep curve with a thin edge: its
    dip is this share of the width, about what a wide screen shows. */
const PHONE_DIP = 0.07;
/** The phone's blur across the curve, at the sides and at the foot, in CSS px. */
const PHONE_EDGE_PX = 40;
const PHONE_SIDES_PX = 16;
const PHONE_FOOT_PX = 30;

function phoneCurveMask(width: number, height: number): string {
  const w = Math.max(8, Math.round(width / 2));
  const h = Math.max(8, Math.round(height / 2));
  // the centre of the edge stays where the wide mask puts it, so as much colour shows
  const centreY = h * (1 - VISIBLE_HEIGHT_RATIO);
  const endY = centreY - PHONE_DIP * w;
  return computeCurveMask({
    w, h, endY, controlY: (centreY - 0.25 * endY) / 0.75,
    edge: PHONE_EDGE_PX / 2, sides: PHONE_SIDES_PX / 2, foot: PHONE_FOOT_PX / 2,
  });
}

type Props = {
  u: number;
  v: number;
  held?: boolean;
  sample?: (u: number, v: number) => Oklch;
  opacity?: number;
  onPick: (next: { u: number; v: number; color: Oklch }) => void;
};

/**
 * Full-width muted OKLCH wash. Click / drag like a Figma picker —
 * color is computed from UV, not from the blurred pixels.
 */
export function OklchColorField({ u, v, held = false, onPick, sample = sampleField, opacity = 0.6 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const water = useRef<PaletteWater | null>(null);
  const dragging = useRef(false);
  const heldRef = useRef(held);
  const lastFollow = useRef({ u, v, t: 0 });
  const hoverUv = useRef({ u, v, t: 0 });
  const flowPx = useRef({ x: 0, y: 0 });
  const [liveWater, setLiveWater] = useState(false);
  const compact = useCompact();
  const [phoneMask, setPhoneMask] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!compact || !el) {
      setPhoneMask(null);
      return;
    }
    let size = "";
    const bake = () => {
      const next = `${el.offsetWidth}x${el.offsetHeight}`;
      if (next === size || !el.offsetWidth || !el.offsetHeight) return;
      size = next;
      setPhoneMask(phoneCurveMask(el.offsetWidth, el.offsetHeight));
    };
    bake();
    const observer = new ResizeObserver(bake);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);
  const mask = compact ? phoneMask ?? "none" : CURVE_MASK;

  const slideWash = (du: number, dv: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    flowPx.current.x = flowPx.current.x * 0.72 + du * 46;
    flowPx.current.y = flowPx.current.y * 0.72 + dv * 32;
    canvas.style.transform = `translate(${flowPx.current.x}px, ${flowPx.current.y}px) scale(1.04, 1.12)`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = COLS;
    canvas.height = ROWS;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const img = ctx.createImageData(COLS, ROWS);
    const data = img.data;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ny = y / (ROWS - 1);
        const hex = oklchToHex(sample(x / (COLS - 1), ny));
        const i = (y * COLS + x) * 4;
        data[i] = parseInt(hex.slice(1, 3), 16);
        data[i + 1] = parseInt(hex.slice(3, 5), 16);
        data[i + 2] = parseInt(hex.slice(5, 7), 16);
        const t = ny < 0.16 ? (ny / 0.16) ** 1.35 : 1;
        data[i + 3] = Math.round(255 * t);
      }
    }
    ctx.putImageData(img, 0, 0);

    const overlay = waterRef.current;
    const quiet =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!overlay || quiet) return;
    const sim = createPaletteWater(overlay, canvas);
    water.current = sim;
    setLiveWater(!!sim);
    const onResize = () => sim?.resize();
    window.addEventListener("resize", onResize);
    let raf = 0;
    const ease = () => {
      const f = flowPx.current;
      f.x *= 0.9;
      f.y *= 0.9;
      canvas.style.transform = `translate(${f.x}px, ${f.y}px) scale(1.04, 1.12)`;
      raf = requestAnimationFrame(ease);
    };
    raf = requestAnimationFrame(ease);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      sim?.dispose();
      water.current = null;
      setLiveWater(false);
    };
  }, [sample]);

  useEffect(() => {
    const wasHeld = heldRef.current;
    heldRef.current = held;
    if (held && !wasHeld) water.current?.ripple(u, v);
  }, [held, u, v]);

  useEffect(() => {
    if (heldRef.current) {
      lastFollow.current = { u, v, t: performance.now() };
      return;
    }
    const now = performance.now();
    const prev = lastFollow.current;
    const dt = Math.max(now - (prev.t || now), 8);
    const speed = Math.hypot(u - prev.u, v - prev.v) / (dt / 1000);
    lastFollow.current = { u, v, t: now };
    slideWash(u - prev.u, v - prev.v);
    water.current?.stir(u, v, speed);
  }, [u, v]);

  const uvAt = (clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      u: clamp01((clientX - rect.left) / rect.width),
      v: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const pickAt = (clientX: number, clientY: number) => {
    const next = uvAt(clientX, clientY);
    if (!next) return;
    onPick({ u: next.u, v: next.v, color: sample(next.u, next.v) });
  };

  const stirAt = (clientX: number, clientY: number) => {
    const next = uvAt(clientX, clientY);
    if (!next || heldRef.current) return;
    const now = performance.now();
    const prev = hoverUv.current;
    const dt = Math.max(now - (prev.t || now), 8);
    const speed = Math.hypot(next.u - prev.u, next.v - prev.v) / (dt / 1000);
    hoverUv.current = { ...next, t: now };
    slideWash(next.u - prev.u, next.v - prev.v);
    water.current?.stir(next.u, next.v, speed);
  };

  return (
    <div
      ref={wrapRef}
      role="slider"
      aria-label="color field"
      aria-valuetext="oklch wash"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = uvAt(e.clientX, e.clientY);
        pickAt(e.clientX, e.clientY);
        if (at) water.current?.ripple(at.u, at.v);
      }}
      onPointerMove={(e) => {
        stirAt(e.clientX, e.clientY);
        if (!dragging.current) return;
        pickAt(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(${WASH_HEIGHT} / ${VISIBLE_HEIGHT_RATIO})`,
        minHeight: WASH_MIN_PX / VISIBLE_HEIGHT_RATIO,
        zIndex: 10,
        cursor: "crosshair",
        touchAction: "none",
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          filter: "blur(18px) saturate(0.92)",
          transform: "scale(1.04, 1.12)",
          transformOrigin: "center bottom",
          opacity,
          pointerEvents: "none",
          transition: "transform 80ms linear",
        }}
      />
      <canvas
        ref={waterRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          visibility: liveWater ? "visible" : "hidden",
          filter: "blur(6px)",
          transform: "scale(1.04, 1.12)",
          transformOrigin: "center bottom",
          opacity: liveWater ? 0.85 : 0,
          mixBlendMode: "soft-light",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: "42%",
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 60%, transparent 100%)",
          filter: "blur(16px)",
          opacity: 0.6,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: `${u * 100}%`,
          top: `${v * 100}%`,
          width: held ? 14 : 18,
          height: held ? 14 : 18,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.92)",
          boxShadow: "0 0 0 1px rgba(70,70,78,0.28), 0 2px 10px rgba(40,40,48,0.18)",
          background: held ? "rgba(255,255,255,0.55)" : "transparent",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
