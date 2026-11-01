import { useSyncExternalStore } from "react";
import { _roots, addAfterEffect, invalidate } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { freezeCapture } from "./captureFreeze";
import { EXPORT_LONG, type ExportFormat, type ExportPreset } from "./cameraGrade";

/**
 * A photograph of the current page.
 *
 * Each page marks the layers that belong in the picture (`data-capture-root`,
 * `data-capture-frame`, `data-capture-plate`). A root hidden behind an opaque
 * page is left out, so the gallery sitting under the pond is not composited
 * back on top of the water. The selected canvases are drawn again at the
 * requested size through the same renderers, then put back. The clock is held
 * still for that turn. The file's real pixel size is what the caller is told;
 * a size the GPU cannot draw is reported smaller, and is never scaled up.
 */

export type ExportRequest = {
  preset: ExportPreset;
  customW: number;
  customH: number;
  format: ExportFormat;
  jpgQuality: number;
  /** Draw the page's words and controls over the picture. The render menu stays out. */
  includeUi?: boolean;
  onProgress?: (note: string) => void;
};

export type ExportResult = { width: number; height: number; limitedTo: number | null };

type Layer = {
  el: HTMLElement;
  canvas: HTMLCanvasElement | null;
  key: number[];
};

export type CapturePixels = { width: number; height: number };

type Raised = { state: RootState; canvas: HTMLCanvasElement; dpr: number };

type Job = {
  layers: Layer[];
  copies: Map<HTMLCanvasElement, HTMLCanvasElement>;
  /** Output pixels per CSS pixel. */
  scale: number;
  pixelRatio: number;
  screenRatio: Map<HTMLCanvasElement, number>;
  pageW: number;
  pageH: number;
  requestedLong: number;
  limitedTo: number | null;
  format: ExportFormat;
  quality: number;
  includeUi: boolean;
  reading: boolean;
  attempts: number;
  raised: Raised[];
  onProgress: (note: string) => void;
  release: () => void;
  resolve: (result: ExportResult) => void;
  reject: (error: Error) => void;
};

const BLEND: Record<string, GlobalCompositeOperation> = {
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

let job: Job | null = null;
let wired = false;
const listeners = new Set<() => void>();
const redrawers = new WeakMap<HTMLCanvasElement, (pixels?: CapturePixels) => void>();

function snapshot(): Job | null {
  return job;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Pixel ratio a scene should size its own buffers to. During an export this is
 * the output scale for a canvas that is actually in the picture, and the
 * scene's own ratio otherwise.
 */
export function useExportDrawingDpr(canvas: HTMLCanvasElement, fallback: number): number {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!current) return fallback;
  for (const layer of current.layers) {
    if (layer.canvas === canvas) return current.pixelRatio;
  }
  return fallback;
}

/**
 * How much screen-space grain should enlarge so it keeps its size on screen.
 * 1 while nothing is exporting.
 */
export function captureFragScaleFor(canvas: HTMLCanvasElement): number {
  if (!job) return 1;
  const screen = job.screenRatio.get(canvas) ?? 0;
  if (screen < 0.2) return 1;
  return Math.max(1, job.pixelRatio / screen);
}

/** A canvas with extra render targets marks the size those targets reached. */
export function markCaptureTargets(canvas: HTMLCanvasElement, width: number, height: number) {
  canvas.dataset.captureTargets = "1";
  canvas.dataset.captureReady = `${Math.max(1, width)}x${Math.max(1, height)}`;
}

/** A custom WebGL canvas redraws its current frame, then the snapshot reads it. */
export function registerCaptureRedraw(canvas: HTMLCanvasElement, redraw: ((pixels?: CapturePixels) => void) | null) {
  if (redraw) redrawers.set(canvas, redraw);
  else redrawers.delete(canvas);
}

function stateOf(canvas: HTMLCanvasElement): RootState | null {
  const root = _roots.get(canvas);
  return root ? root.store.getState() : null;
}

function colorAlpha(color: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) return color && color !== "transparent" ? 1 : 0;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 4) return 1;
  const alpha = Number(parts[3]);
  return Number.isFinite(alpha) ? alpha : 1;
}

function opaque(color: string): boolean {
  return colorAlpha(color) >= 0.92;
}

/** Product of ancestor opacity. Zero when the element is not shown. */
function displayedOpacity(el: HTMLElement): number {
  let opacity = 1;
  let node: HTMLElement | null = el;
  while (node) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    opacity *= Number(style.opacity);
    if (opacity < 0.02) return 0;
    node = node.parentElement;
  }
  return opacity;
}

function onScreen(rect: DOMRect): boolean {
  const w = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const h = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return w >= 2 && h >= 2;
}

function rotationOf(el: HTMLElement): number {
  let rad = 0;
  let node: HTMLElement | null = el;
  while (node) {
    const t = getComputedStyle(node).transform;
    if (t && t !== "none") {
      try {
        const m = new DOMMatrix(t);
        rad += Math.atan2(m.b, m.a);
      } catch {
        // an unreadable transform is drawn in the box it occupies
      }
    }
    node = node.parentElement;
  }
  return rad;
}

function blendOf(el: HTMLElement): GlobalCompositeOperation {
  let node: HTMLElement | null = el;
  while (node) {
    const mode = BLEND[getComputedStyle(node).mixBlendMode];
    if (mode) return mode;
    node = node.parentElement;
  }
  return "source-over";
}

function filterOf(el: HTMLElement, scale: number): string {
  let node: HTMLElement | null = el;
  while (node) {
    const filter = getComputedStyle(node).filter;
    if (filter && filter !== "none" && !filter.includes("url(")) {
      return filter.replace(/blur\(([\d.]+)px\)/g, (_, px: string) => `blur(${Number(px) * scale}px)`);
    }
    node = node.parentElement;
  }
  return "none";
}

function unrotated(rect: DOMRect, angle: number): { w: number; h: number } {
  if (Math.abs(angle) < 0.02) return { w: rect.width, h: rect.height };
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const det = c * c - s * s;
  if (Math.abs(det) < 0.08) {
    const side = rect.width / (c + s);
    return { w: side, h: side };
  }
  const w = (rect.width * c - rect.height * s) / det;
  const h = (rect.height * c - rect.width * s) / det;
  if (w < 1 || h < 1) {
    const side = rect.width / (c + s);
    return { w: side, h: side };
  }
  return { w, h };
}

/** A gradient that still covers what is behind it. A veil that fades out does not. */
function solidBackdrop(style: CSSStyleDeclaration): boolean {
  const image = style.backgroundImage;
  if (image && image !== "none") {
    if (/transparent/i.test(image)) return false;
    if (/#(?:[0-9a-f]{4}|[0-9a-f]{8})\b/i.test(image)) return false;
    for (const match of image.matchAll(/rgba?\([^)]*\)/g)) {
      if (colorAlpha(match[0]) < 0.92) return false;
    }
    return true;
  }
  return opaque(style.backgroundColor);
}

function styleZ(el: HTMLElement): { band: number; level: number } {
  const style = getComputedStyle(el);
  if (style.position === "static" || style.zIndex === "auto") return { band: 0, level: 0 };
  const level = Number(style.zIndex) || 0;
  if (level < 0) return { band: -1, level };
  if (level === 0) return { band: 0, level: 0 };
  return { band: 1, level };
}

/** Paint order from the document, so a z-index is only compared with its siblings. */
function paintKey(el: HTMLElement): number[] {
  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    chain.push(node);
    node = node.parentElement;
  }
  chain.reverse();
  const key: number[] = [];
  for (const item of chain) {
    const z = styleZ(item);
    const parent = item.parentElement;
    const index = parent ? Array.prototype.indexOf.call(parent.children, item) : 0;
    key.push(z.band, z.level, index);
  }
  return key;
}

function compareKey(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function covers(el: HTMLElement, rect: DOMRect): boolean {
  const box = el.getBoundingClientRect();
  return box.left <= rect.left + 2 && box.top <= rect.top + 2
    && box.right >= rect.right - 2 && box.bottom >= rect.bottom - 2;
}

function occluded(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (!onScreen(rect)) return true;
  const key = paintKey(el);
  for (const node of document.body.querySelectorAll("*")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node === el || node.contains(el) || el.contains(node)) continue;
    if (displayedOpacity(node) < 0.92) continue;
    if (!solidBackdrop(getComputedStyle(node))) continue;
    if (!covers(node, rect)) continue;
    if (compareKey(paintKey(node), key) > 0) return true;
  }
  return false;
}

function backingColor(root: HTMLElement): string {
  let node: HTMLElement | null = root;
  while (node) {
    const style = getComputedStyle(node);
    if (opaque(style.backgroundColor)) return style.backgroundColor;
    node = node.parentElement;
  }
  return "#e4e4e6";
}

function activeRoots(): HTMLElement[] {
  const all = [...document.querySelectorAll("[data-capture-root]")]
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
  const visible = all.filter((el) => displayedOpacity(el) > 0.02 && !occluded(el));
  return visible.filter((el) => !visible.some((other) => other !== el && other.contains(el)));
}

function collect(roots: HTMLElement[]): Layer[] {
  const layers: Layer[] = [];
  for (const root of roots) {
    const nodes = root.querySelectorAll("[data-capture-frame], [data-capture-plate]");
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (displayedOpacity(node) <= 0) continue;
      const rect = node.getBoundingClientRect();
      if (!onScreen(rect)) continue;
      const canvas = node instanceof HTMLCanvasElement ? node : null;
      layers.push({ el: node, canvas, key: paintKey(node) });
    }
  }
  layers.sort((a, b) => compareKey(a.key, b.key));
  return layers;
}

let textureLimit = 0;

function maxTextureSize(): number {
  if (textureLimit) return textureLimit;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const max = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 4096;
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  textureLimit = Math.max(1024, Number.isFinite(max) && max > 0 ? max : 4096);
  return textureLimit;
}

/** The requested picture, in the viewport's aspect, clamped to the GPU. */
function outputSize(request: ExportRequest): { scale: number; pageW: number; pageH: number; requestedLong: number; limitedTo: number | null } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 2 || vh < 2) return null;
  const maxEdge = Math.min(maxTextureSize(), 8192);
  let pageW: number;
  let pageH: number;
  let requestedLong: number;
  if (request.preset === "custom") {
    const boxW = Math.max(2, request.customW);
    const boxH = Math.max(2, request.customH);
    requestedLong = Math.max(boxW, boxH);
    if (boxW / boxH > vw / vh) {
      pageH = boxH;
      pageW = Math.round(boxH * vw / vh);
    } else {
      pageW = boxW;
      pageH = Math.round(boxW * vh / vw);
    }
  } else {
    requestedLong = EXPORT_LONG[request.preset];
    if (vw >= vh) {
      pageW = requestedLong;
      pageH = Math.round(requestedLong * vh / vw);
    } else {
      pageH = requestedLong;
      pageW = Math.round(requestedLong * vw / vh);
    }
  }
  let limitedTo: number | null = null;
  const long = Math.max(pageW, pageH);
  if (long > maxEdge) {
    const fit = maxEdge / long;
    pageW = Math.max(2, Math.round(pageW * fit));
    pageH = Math.max(2, Math.round(pageH * fit));
    limitedTo = Math.max(pageW, pageH);
  }
  return {
    scale: pageW / vw,
    pageW,
    pageH,
    requestedLong,
    limitedTo,
  };
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  if (source.width < 2 || source.height < 2) return null;
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return copy;
}

function pixelsFor(canvas: HTMLCanvasElement, scale: number): CapturePixels {
  const maxEdge = Math.min(maxTextureSize(), 8192);
  let width = Math.max(1, Math.round(canvas.clientWidth * scale));
  let height = Math.max(1, Math.round(canvas.clientHeight * scale));
  const long = Math.max(width, height);
  if (long > maxEdge) {
    const fit = maxEdge / long;
    width = Math.max(1, Math.round(width * fit));
    height = Math.max(1, Math.round(height * fit));
  }
  return { width, height };
}

function splitArgs(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (c === "," && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

function isStop(arg: string): boolean {
  return /^(#|rgba?\(|hsla?\(|transparent\b|white\b|black\b)/i.test(arg.trim());
}

function parseStop(arg: string): { color: string; at: number | null } {
  const pct = /([\d.]+)%\s*$/.exec(arg.trim());
  if (!pct) return { color: arg.trim(), at: null };
  return { color: arg.slice(0, pct.index).trim(), at: Number(pct[1]) / 100 };
}

function placeStops(stops: { color: string; at: number | null }[]): { color: string; at: number }[] {
  const placed = stops.map((stop) => ({ ...stop }));
  if (!placed.length) return [];
  if (placed[0].at === null) placed[0].at = 0;
  if (placed[placed.length - 1].at === null) placed[placed.length - 1].at = 1;
  for (let i = 0; i < placed.length; i++) {
    if (placed[i].at !== null) continue;
    let next = i + 1;
    while (next < placed.length && placed[next].at === null) next += 1;
    const from = placed[i - 1].at ?? 0;
    const to = placed[next].at ?? 1;
    const span = next - (i - 1);
    for (let k = i; k < next; k++) placed[k].at = from + (to - from) * ((k - (i - 1)) / span);
    i = next;
  }
  return placed.map((stop) => ({ color: stop.color, at: stop.at ?? 0 }));
}

function paintGradient(ctx: CanvasRenderingContext2D, layer: string, x: number, y: number, w: number, h: number) {
  const match = /^(linear|radial)-gradient\((.*)\)$/is.exec(layer.trim());
  if (!match) return;
  const args = splitArgs(match[2]);
  const stopArgs = isStop(args[0] ?? "") ? args : args.slice(1);
  const head = isStop(args[0] ?? "") ? "" : (args[0] ?? "");
  const stops = placeStops(stopArgs.filter(isStop).map(parseStop));
  if (!stops.length) return;
  const add = (gradient: CanvasGradient) => {
    for (const stop of stops) gradient.addColorStop(Math.min(1, Math.max(0, stop.at)), stop.color);
  };
  if (match[1].toLowerCase() === "linear") {
    let x0 = x;
    let y0 = y;
    let x1 = x;
    let y1 = y + h;
    if (/to top/.test(head)) { y0 = y + h; y1 = y; }
    else if (/to right/.test(head)) { x1 = x + w; y1 = y; }
    else if (/to left/.test(head)) { x0 = x + w; y1 = y; }
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    add(gradient);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    return;
  }
  const at = /([\d.]+)%\s+([\d.]+)%/.exec(head);
  const px = at ? Number(at[1]) / 100 : 0.5;
  const py = at ? Number(at[2]) / 100 : 0.5;
  const cx = x + w * px;
  const cy = y + h * py;
  const rx = Math.max(Math.abs(cx - x), Math.abs(cx - (x + w)), 1);
  const ry = Math.max(Math.abs(cy - y), Math.abs(cy - (y + h)), 1);
  const circle = /\bcircle\b/.test(head);
  ctx.save();
  ctx.translate(cx, cy);
  if (!circle) ctx.scale(1, ry / rx);
  const radius = circle ? Math.hypot(rx, ry) : rx;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  add(gradient);
  ctx.fillStyle = gradient;
  const sy = circle ? 1 : rx / ry;
  ctx.fillRect(x - cx, (y - cy) * sy, w, h * sy);
  ctx.restore();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration, x: number, y: number, w: number, h: number) {
  if (opaque(style.backgroundColor) || colorAlpha(style.backgroundColor) > 0.01) {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(x, y, w, h);
  }
  const image = style.backgroundImage;
  if (!image || image === "none") return;
  for (const layer of splitArgs(image)) paintGradient(ctx, layer, x, y, w, h);
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, source: HTMLCanvasElement | null, scale: number) {
  const opacity = displayedOpacity(layer.el);
  if (opacity <= 0) return;
  const rect = layer.el.getBoundingClientRect();
  if (!onScreen(rect)) return;
  const angle = rotationOf(layer.el);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blendOf(layer.el);
  ctx.filter = filterOf(layer.el, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const x = rect.left * scale;
  const y = rect.top * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;
  if (!source) {
    const radius = getComputedStyle(layer.el).borderRadius;
    if (radius && radius !== "0px") {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      ctx.clip();
    }
    paintBackdrop(ctx, getComputedStyle(layer.el), x, y, w, h);
    ctx.restore();
    return;
  }
  if (Math.abs(angle) < 0.02) {
    ctx.drawImage(source, x, y, w, h);
  } else {
    const size = unrotated(rect, angle);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    ctx.drawImage(source, (-size.w * scale) / 2, (-size.h * scale) / 2, size.w * scale, size.h * scale);
  }
  ctx.restore();
}

function compose(done: Job, roots: HTMLElement[]): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = done.pageW;
  out.height = done.pageH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("couldn't render");
  const base = roots[0] ? backingColor(roots[0]) : "#e4e4e6";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, out.width, out.height);
  for (const root of roots) {
    const style = getComputedStyle(root);
    if (!style.backgroundImage || style.backgroundImage === "none") continue;
    const rect = root.getBoundingClientRect();
    ctx.save();
    ctx.globalAlpha = displayedOpacity(root);
    paintBackdrop(ctx, style, rect.left * done.scale, rect.top * done.scale, rect.width * done.scale, rect.height * done.scale);
    ctx.restore();
  }
  for (const layer of done.layers) {
    const source = layer.canvas ? done.copies.get(layer.canvas) ?? null : null;
    if (layer.canvas && !source) continue;
    drawLayer(ctx, layer, source, done.scale);
  }
  return out;
}

function fileName(format: ExportFormat, width: number, height: number): string {
  const ext = format === "png" ? "png" : "jpg";
  return `nijimu-${width}x${height}.${ext}`;
}

function restoreRaised(current: Job) {
  for (const item of current.raised) {
    try { item.state.setDpr(item.dpr); } catch { /* the canvas has gone */ }
    delete item.canvas.dataset.captureWant;
  }
  current.raised = [];
}

function finish(current: Job, error?: Error, page?: HTMLCanvasElement) {
  restoreRaised(current);
  if (job === current) job = null;
  emit();
  current.release();
  if (error || !page) {
    current.reject(error ?? new Error("couldn't render"));
    return;
  }
  current.onProgress("encoding…");
  const mime = current.format === "png" ? "image/png" : "image/jpeg";
  page.toBlob((blob) => {
    if (!blob) {
      current.reject(new Error("couldn't render"));
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(current.format, page.width, page.height);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    current.resolve({ width: page.width, height: page.height, limitedTo: current.limitedTo });
  }, mime, current.format === "jpg" ? current.quality : undefined);
}

function wantOf(canvas: HTMLCanvasElement, ratio: number): { width: number; height: number; key: string } {
  const width = Math.max(1, Math.round(Math.max(1, canvas.clientWidth) * ratio));
  const height = Math.max(1, Math.round(Math.max(1, canvas.clientHeight) * ratio));
  return { width, height, key: `${width}x${height}` };
}

function near(got: number, want: number): boolean {
  return got > 0 && Math.abs(got - want) <= Math.max(2, want * 0.08);
}

function bufferReady(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  // The drawing buffer and any extra targets both have to be the asked size.
  // A stale larger mark must not count, or a smaller export would copy the
  // screen-sized targets. A mark written before the canvas actually grew
  // must not count either, or a blank 8K file would be saved.
  if (!near(canvas.width, width) || !near(canvas.height, height)) return false;
  if (canvas.dataset.captureTargets !== "1") return true;
  const [rw, rh] = (canvas.dataset.captureReady ?? "").split("x").map(Number);
  return near(rw, width) && near(rh, height);
}

function fiberLayers(current: Job): HTMLCanvasElement[] {
  const list: HTMLCanvasElement[] = [];
  for (const layer of current.layers) {
    if (layer.canvas && stateOf(layer.canvas)) list.push(layer.canvas);
  }
  return list;
}

function achievedRatio(current: Job): number {
  let ratio = current.pixelRatio;
  for (const canvas of fiberLayers(current)) {
    const css = Math.max(1, canvas.clientWidth);
    const reported = canvas.dataset.captureReady ?? "";
    const rw = Number(reported.split("x")[0]);
    const buffer = canvas.width / css;
    const marked = canvas.dataset.captureTargets === "1" && rw > 0 ? rw / css : buffer;
    const got = buffer > 0 ? Math.min(marked, buffer) : marked;
    if (got > 0) ratio = Math.min(ratio, got);
  }
  return ratio;
}

function applyRatio(current: Job, ratio: number) {
  current.pixelRatio = ratio;
  current.scale = ratio;
  current.pageW = Math.max(2, Math.round(window.innerWidth * ratio));
  current.pageH = Math.max(2, Math.round(window.innerHeight * ratio));
  for (const item of current.raised) {
    const want = wantOf(item.canvas, ratio);
    item.canvas.dataset.captureWant = want.key;
    item.state.setDpr(ratio);
    if (item.canvas.dataset.captureTargets !== "1") {
      item.canvas.dataset.captureReady = `${item.canvas.width}x${item.canvas.height}`;
    }
  }
}

function buffersReady(current: Job): boolean {
  for (const canvas of fiberLayers(current)) {
    const want = wantOf(canvas, current.pixelRatio);
    if (!bufferReady(canvas, want.width, want.height)) return false;
  }
  return true;
}

function wake(layers: Layer[]) {
  for (const layer of layers) {
    if (!layer.canvas) continue;
    const state = stateOf(layer.canvas);
    if (state) invalidate(state);
  }
}

function copyLayers(current: Job) {
  for (const layer of current.layers) {
    const canvas = layer.canvas;
    if (!canvas || current.copies.has(canvas)) continue;
    const redraw = redrawers.get(canvas);
    if (redraw) {
      const prevW = canvas.width;
      const prevH = canvas.height;
      redraw(pixelsFor(canvas, current.scale));
      const copy = copyCanvas(canvas);
      canvas.width = prevW;
      canvas.height = prevH;
      redraw();
      if (copy) current.copies.set(canvas, copy);
      continue;
    }
    const copy = copyCanvas(canvas);
    if (copy) current.copies.set(canvas, copy);
  }
}

function wire() {
  if (wired) return;
  wired = true;
  addAfterEffect(() => {
    const current = job;
    if (!current || current.reading) return;
    if (!buffersReady(current)) {
      current.attempts += 1;
      if (current.attempts === 24) {
        const got = achievedRatio(current);
        if (got >= 0.25 && got < current.pixelRatio * 0.9) {
          current.limitedTo = Math.max(
            Math.round(window.innerWidth * got),
            Math.round(window.innerHeight * got),
          );
          applyRatio(current, got);
          wake(current.layers);
          return;
        }
      }
      if (current.attempts > 48) {
        finish(current, new Error("couldn't render"));
        return;
      }
      wake(current.layers);
      return;
    }
    current.reading = true;
    queueMicrotask(() => {
      if (job !== current) return;
      try {
        copyLayers(current);
        const roots = activeRoots();
        finish(current, undefined, compose(current, roots));
      } catch (error) {
        finish(current, error instanceof Error ? error : new Error("couldn't render"));
      }
    });
  });
}

function raiseFiber(current: Job) {
  for (const canvas of fiberLayers(current)) {
    const state = stateOf(canvas);
    if (!state) continue;
    const css = Math.max(1, canvas.clientWidth);
    current.screenRatio.set(canvas, canvas.width / css);
    current.raised.push({ state, canvas, dpr: state.viewport.dpr });
    const want = wantOf(canvas, current.pixelRatio);
    canvas.dataset.captureWant = want.key;
    state.setDpr(current.pixelRatio);
    if (canvas.dataset.captureTargets !== "1") {
      canvas.dataset.captureReady = `${canvas.width}x${canvas.height}`;
    }
  }
}

/**
 * Photograph the current page at the requested size and save a PNG or JPEG.
 * The picture is the page's own frames, drawn again at that size.
 */
export function exportScene(request: ExportRequest): Promise<ExportResult> {
  if (job) return Promise.reject(new Error("already rendering"));
  const release = freezeCapture();
  const page = outputSize(request);
  const roots = activeRoots();
  const layers = collect(roots);
  if (!page || layers.length === 0) {
    release();
    return Promise.reject(new Error("nothing to render"));
  }
  const current: Job = {
    layers,
    copies: new Map(),
    scale: page.scale,
    pixelRatio: page.scale,
    screenRatio: new Map(),
    pageW: page.pageW,
    pageH: page.pageH,
    requestedLong: page.requestedLong,
    limitedTo: page.limitedTo,
    format: request.format,
    quality: Math.min(1, Math.max(0.5, request.jpgQuality)),
    includeUi: false,
    reading: false,
    attempts: 0,
    raised: [],
    onProgress: request.onProgress ?? (() => {}),
    release,
    resolve: () => {},
    reject: () => {},
  };
  const fiber = fiberLayers(current);
  wire();
  request.onProgress?.("rendering…");
  if (fiber.length === 0) {
    try {
      copyLayers(current);
      const pageCanvas = compose(current, roots);
      return new Promise<ExportResult>((resolve, reject) => {
        current.resolve = resolve;
        current.reject = reject;
        finish(current, undefined, pageCanvas);
      });
    } catch (error) {
      release();
      return Promise.reject(error instanceof Error ? error : new Error("couldn't render"));
    }
  }
  return new Promise<ExportResult>((resolve, reject) => {
    current.resolve = resolve;
    current.reject = reject;
    job = current;
    emit();
    raiseFiber(current);
    wake(current.layers);
  });
}
