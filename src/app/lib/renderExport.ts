/**
 * A page exported the way the naming card is printed.
 *
 * The layout is in CSS pixels. The canvas is four times that, and everything
 * is drawn through that scale, not enlarged afterwards: the 3D scenes and the
 * washes are drawn again at twice their screen density for it. The ground is
 * the card's light, then its wall grain, then the page's pictures, then its
 * film grain, and only then the words and controls. Both grains come from
 * memoryImage / filmGrain, on the 1× grid, so the file scaled back to 1× keeps
 * their size.
 */

import { freezeCapture } from "./captureFreeze";
import { setCaptureBoost } from "./captureScale";
import { applyCardFilmGrain, applyWallGrain, cardLight, imageTextLines } from "./memoryImage";

export type CaptureRequest = {
  /** Draw the page's words and controls after the film grain. The render menu stays out either way. */
  includeUi: boolean;
};

export type CaptureResult = { width: number; height: number };

/** Output pixels per CSS pixel. The grain fields are built on the 1× grid. */
const SCALE = 4;
/** The scenes draw at 2× on screen; for the file, this much denser. */
const BOOST = SCALE / 2;

const CHROME = "[data-render-menu], .dialkit-root, .dialkit-panel, .lab-dock, [data-tune-panel]";

function shown(el: Element): boolean {
  const box = el.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return false;
  if (box.bottom < 0 || box.right < 0 || box.top > window.innerHeight || box.left > window.innerWidth) return false;
  let opacity = 1;
  for (let node: Element | null = el; node && opacity > 0.5; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const own = Number(style.opacity);
    if (Number.isFinite(own)) opacity *= own;
  }
  // The paper's own grain sits near half strength and is replaced by the card grain.
  // A vessel fading back in the gallery is still part of the picture.
  return opacity > 0.5;
}

function isChrome(el: Element): boolean {
  return !!el.closest(`${CHROME}, button, a, header, nav, [role='dialog']`);
}

function paintRank(el: Element): number[] {
  const ranks: number[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    ranks.push(style.zIndex === "auto" ? 0 : Number(style.zIndex) || 0);
  }
  return ranks.reverse();
}

/** The picture actually on top at this point, skipping words and controls laid over it. */
function topCanvasAt(x: number, y: number): HTMLCanvasElement | null {
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLCanvasElement)) continue;
    if (!shown(el) || isChrome(el) || el.closest(CHROME)) continue;
    return el;
  }
  return null;
}

/** Canvases that let the pointer through are still pictures; hit-test all of them while `fn` runs. */
function hittingCanvases<T>(fn: () => T): T {
  const canvases = [...document.querySelectorAll<HTMLCanvasElement>("canvas")];
  const previous = canvases.map(canvas => canvas.style.pointerEvents);
  canvases.forEach(canvas => { canvas.style.pointerEvents = "auto"; });
  try { return fn(); }
  finally { canvases.forEach((canvas, i) => { canvas.style.pointerEvents = previous[i]; }); }
}

/** A canvas buried under the page's picture stays out, even where that picture is clear. */
function exposed(canvas: HTMLCanvasElement): boolean {
  const box = canvas.getBoundingClientRect();
  for (const ty of [0.5, 0.25, 0.75]) {
    for (const tx of [0.5, 0.25, 0.75]) {
      if (topCanvasAt(box.left + box.width * tx, box.top + box.height * ty) === canvas) return true;
    }
  }
  return false;
}

function byPaint(a: Element, b: Element): number {
  const ar = paintRank(a), br = paintRank(b);
  const n = Math.max(ar.length, br.length);
  for (let i = 0; i < n; i++) {
    const d = (ar[i] ?? 0) - (br[i] ?? 0);
    if (d) return d;
  }
  const pos = a.compareDocumentPosition(b);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function pictureOf(source: HTMLCanvasElement | HTMLImageElement, cssW: number, cssH: number): boolean {
  const dw = Math.round(cssW * SCALE), dh = Math.round(cssH * SCALE);
  return Math.abs(source.width - dw) <= 2 && Math.abs(source.height - dh) <= 2;
}

function drawPicture(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement | HTMLImageElement,
  x: number, y: number, w: number, h: number) {
  const sharp = pictureOf(source, w, h);
  ctx.imageSmoothingEnabled = !sharp;
  if (!sharp) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, w, h);
}

function placeOf(cssW: number, cssH: number, pictures: HTMLCanvasElement[]) {
  const aspect = cssH / Math.max(1, cssW);
  let best: HTMLCanvasElement | null = null;
  let area = 0;
  for (const canvas of pictures) {
    const box = canvas.getBoundingClientRect();
    const next = box.width * box.height;
    if (next > area && next < cssW * cssH * 0.85) { best = canvas; area = next; }
  }
  if (!best) return undefined;
  const box = best.getBoundingClientRect();
  return {
    ox: (box.left + box.width / 2) / cssW,
    oy: (box.top + box.height / 2) / cssW,
    fy: box.bottom / cssW,
    bodyW: box.width / cssW,
    aspect,
  };
}

type Icon = { image: HTMLImageElement; x: number; y: number; w: number; h: number };
type Line = {
  text: string; x: number; y: number; font: string; color: string; align: CanvasTextAlign;
  /** The blend the page lays this ink down with, and its opacity down the tree. */
  blend: GlobalCompositeOperation; alpha: number;
  /** `middle` is a glyph whose line box collapsed (the pill's ›). */
  baseline?: CanvasTextBaseline;
};
type Rule = { x: number; y: number; w: number; color: string; weight: number };
/** A button's pill, or the slider knob. Radius is already capped to the box. */
type Plate = {
  x: number; y: number; w: number; h: number; radius: number;
  fill: string; stroke: string; strokeWidth: number; alpha: number;
};
/** The slider's hairline and its end ticks. */
type Bar = { x: number; y: number; w: number; h: number; color: string; alpha: number };
type Chrome = { lines: Line[]; icons: SVGSVGElement[]; rules: Rule[]; plates: Plate[]; bars: Bar[]; knobs: Plate[] };

function sameBox(a: Element, b: Element): boolean {
  const A = a.getBoundingClientRect();
  const B = b.getBoundingClientRect();
  return Math.abs(A.left - B.left) < 4 && Math.abs(A.top - B.top) < 4
    && Math.abs(A.width - B.width) < 8 && Math.abs(A.height - B.height) < 8;
}

/** Words and icons the picture does not cover. A clear control in front does not hide them. */
function onTop(el: Element): boolean {
  const box = el.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + Math.min(Math.max(box.height / 2, 1), 12);
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
  const node = el as HTMLElement;
  const previous = node.style.pointerEvents;
  node.style.pointerEvents = "auto";
  const stack = document.elementsFromPoint(x, y);
  node.style.pointerEvents = previous;
  for (const hit of stack) {
    if (hit === el || el.contains(hit) || (hit.contains(el) && sameBox(hit, el))) return true;
    if (hit instanceof HTMLCanvasElement) return false;
    if (hit.contains(el)) continue;
    const style = getComputedStyle(hit);
    const clear = style.backgroundColor === "rgba(0, 0, 0, 0)" || style.backgroundColor === "transparent";
    if (!clear || style.backgroundImage !== "none") return false;
  }
  return false;
}

/** The blend a parent group paints this element with. The landing's captions invert, then lose their colour. */
function blendOf(el: Element): GlobalCompositeOperation {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const mode = getComputedStyle(node).mixBlendMode;
    if (mode && mode !== "normal") return mode as GlobalCompositeOperation;
  }
  return "source-over";
}

function opacityOf(el: Element): number {
  let opacity = 1;
  for (let node: Element | null = el; node && opacity > 0; node = node.parentElement) {
    const own = Number(getComputedStyle(node).opacity);
    if (Number.isFinite(own)) opacity *= own;
  }
  return opacity;
}

function directText(el: HTMLElement): string {
  let text = "";
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function colorShown(color: string): boolean {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return false;
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) return true;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return (parts.length >= 4 ? parts[3] : 1) > 0.01;
}

function cornerRadius(style: CSSStyleDeclaration, w: number, h: number): number {
  const raw = style.borderTopLeftRadius;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const px = raw.trim().endsWith("%") ? (Math.min(w, h) * n) / 100 : n;
  return Math.min(px, w / 2, h / 2);
}

/** The continue pill is a translucent fill (or, on the outline variant, a hairline border). */
function plateOf(style: CSSStyleDeclaration, box: DOMRect, alpha: number): Plate | null {
  const fill = colorShown(style.backgroundColor) ? style.backgroundColor : "";
  const strokeWidth = parseFloat(style.borderTopWidth) || 0;
  const stroke = strokeWidth > 0 && style.borderTopStyle !== "none" && colorShown(style.borderTopColor) ? style.borderTopColor : "";
  if (!fill && !stroke) return null;
  if (box.width < 1 || box.height < 1) return null;
  return {
    x: box.left, y: box.top, w: box.width, h: box.height,
    radius: cornerRadius(style, box.width, box.height),
    fill, stroke, strokeWidth: stroke ? strokeWidth : 0, alpha,
  };
}

/** The knob is only a `::before` / `::after`. Whichever is showing is the one on the page. */
function pseudoPlate(host: Element, which: "::before" | "::after"): Plate | null {
  const style = getComputedStyle(host, which);
  if (style.content === "none" || style.content === "normal") return null;
  const w = parseFloat(style.width);
  const h = parseFloat(style.height);
  const opacity = parseFloat(style.opacity);
  if (!(w > 0) || !(h > 0) || !(opacity > 0.05) || !colorShown(style.backgroundColor)) return null;
  const box = host.getBoundingClientRect();
  return {
    x: box.left + box.width / 2 - w / 2,
    y: box.top + box.height / 2 - h / 2,
    w, h, radius: cornerRadius(style, w, h),
    fill: style.backgroundColor, stroke: "", strokeWidth: 0,
    alpha: opacityOf(host) * opacity,
  };
}

/** Track, end ticks, knob and the two glyphs. The hairline is too thin for the hit test, and the glyphs sit outside any button. */
function readSlider(icons: SVGSVGElement[], bars: Bar[], knobs: Plate[]) {
  for (const slider of document.querySelectorAll<HTMLElement>(".spectrum-slider")) {
    if (slider.closest(CHROME) || !shown(slider) || !onTop(slider)) continue;
    for (const child of slider.children) {
      const style = getComputedStyle(child);
      const box = child.getBoundingClientRect();
      if (box.height > 16 || box.width < 0.5 || box.height < 0.5 || !colorShown(style.backgroundColor)) continue;
      bars.push({ x: box.left, y: box.top, w: box.width, h: box.height, color: style.backgroundColor, alpha: opacityOf(child) });
    }
    const knob = slider.querySelector(".spectrum-knob");
    if (knob) {
      for (const which of ["::before", "::after"] as const) {
        const plate = pseudoPlate(knob, which);
        if (plate) knobs.push(plate);
      }
    }
    const row = slider.parentElement;
    if (!row) continue;
    for (const svg of row.querySelectorAll("svg")) {
      if (svg instanceof SVGSVGElement && !(svg.parentElement instanceof SVGElement) && shown(svg)) icons.push(svg);
    }
  }
}

/** The pill's › is `line-height: 0`, so its box is a point and the ordinary hit test misses it. It still paints, centred on that point. */
function collapsedGlyph(el: HTMLElement): Line | null {
  const box = el.getBoundingClientRect();
  if (box.width < 1 || box.height >= 1) return null;
  const style = getComputedStyle(el);
  if (style.lineHeight !== "0px" || style.visibility === "hidden" || style.display === "none") return null;
  const text = directText(el);
  const host = el.closest("button");
  if (!text || !host || host.closest(CHROME) || !shown(host) || !onTop(host)) return null;
  return {
    text, x: box.left, y: box.top,
    font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
    color: style.color, align: "left", blend: blendOf(el), alpha: opacityOf(el), baseline: "middle",
  };
}

function readChrome(): Chrome {
  const lines: Line[] = [];
  const icons: SVGSVGElement[] = [];
  const rules: Rule[] = [];
  const plates: Plate[] = [];
  const bars: Bar[] = [];
  const knobs: Plate[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    if (el.closest(CHROME)) continue;
    if (!shown(el)) {
      if (el.parentElement?.closest("button")) {
        const glyph = collapsedGlyph(el);
        if (glyph) lines.push(glyph);
      }
      continue;
    }
    if (!onTop(el)) continue;
    if (el.closest("svg")) {
      if (el instanceof SVGSVGElement && isChrome(el) && !(el.parentElement instanceof SVGElement)) icons.push(el);
      continue;
    }
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const rule = parseFloat(style.borderTopWidth) || 0;
    if ((el.tagName === "HR" || (rule >= 1 && style.borderTopStyle === "solid" && box.height <= 8))) {
      rules.push({
        x: box.left, y: box.top + box.height / 2, w: box.width,
        color: style.borderTopColor || style.backgroundColor, weight: el.tagName === "HR" ? 1 : rule,
      });
    }
    if (el.tagName === "BUTTON") {
      const plate = plateOf(style, box, opacityOf(el));
      if (plate) plates.push(plate);
    }
    if (el.classList.contains("sr-only")) continue;
    const nodes = [...el.childNodes];
    const broken = nodes.some(node => node.nodeName === "BR");
    if (!broken && !directText(el)) continue;
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const padT = parseFloat(style.paddingTop) || 0;
    const align: CanvasTextAlign = style.textAlign === "center" || style.textAlign === "right" ? style.textAlign : "left";
    const maxW = Math.max(1, box.width - padL - padR);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) continue;
    probe.font = font;
    const parsed = parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(parsed) ? parsed : (parseFloat(style.fontSize) || 12) * 1.4;
    const x = align === "center" ? box.left + box.width / 2 : align === "right" ? box.right - padR : box.left + padL;
    const ink = { font, color: style.color, align, blend: blendOf(el), alpha: opacityOf(el) };
    // A <br> keeps each sentence on its own line. Joining the text nodes draws them as one.
    const chunks = broken ? (() => {
      const parts: string[] = [];
      let chunk = "";
      for (const node of nodes) {
        if (node.nodeName === "BR") { parts.push(chunk.replace(/\s+/g, " ").trim()); chunk = ""; continue; }
        if (node.nodeType === Node.TEXT_NODE) chunk += node.textContent ?? "";
      }
      parts.push(chunk.replace(/\s+/g, " ").trim());
      return parts;
    })() : null;
    const texts = chunks ?? [directText(el)];
    if (!texts.some(Boolean)) continue;
    let y = box.top + padT;
    for (const text of texts) {
      const wrapped = text ? imageTextLines(text, maxW, value => probe.measureText(value).width) : [""];
      for (const line of wrapped) {
        if (line) lines.push({ text: line, x, y, ...ink });
        y += lineHeight;
      }
    }
  }
  readSlider(icons, bars, knobs);
  return { lines, icons, rules, plates, bars, knobs };
}

function paintPlate(ctx: CanvasRenderingContext2D, plate: Plate) {
  const radius = Math.min(plate.radius, plate.w / 2, plate.h / 2);
  const inset = plate.stroke && !plate.fill ? plate.strokeWidth / 2 : 0;
  ctx.globalAlpha = plate.alpha;
  ctx.beginPath();
  ctx.roundRect(
    plate.x + inset, plate.y + inset,
    Math.max(0, plate.w - inset * 2), Math.max(0, plate.h - inset * 2),
    Math.max(0, radius - inset),
  );
  if (plate.fill) { ctx.fillStyle = plate.fill; ctx.fill(); }
  if (plate.stroke) {
    ctx.strokeStyle = plate.stroke;
    ctx.lineWidth = plate.strokeWidth;
    ctx.stroke();
  }
}

/** The paint an icon only has from CSS — colour, width, and the dash that hides the enter arrow's stem. */
function bakeIconPaint(live: Element, copy: Element) {
  if (!(copy instanceof SVGElement)) return;
  const style = getComputedStyle(live);
  const paint: [string, string][] = [
    ["stroke", style.stroke],
    ["stroke-width", style.strokeWidth],
    ["stroke-linecap", style.strokeLinecap],
    ["stroke-linejoin", style.strokeLinejoin],
    ["stroke-dasharray", style.strokeDasharray],
    ["stroke-dashoffset", style.strokeDashoffset],
    ["fill", style.fill],
  ];
  for (const [name, value] of paint) {
    if (!value || value === "none") continue;
    if ((name === "stroke-dasharray" || name === "stroke-dashoffset") && (value === "0" || value === "0px")) continue;
    copy.setAttribute(name, value);
  }
  if (style.opacity !== "1") copy.setAttribute("opacity", style.opacity);
}

async function iconBitmaps(icons: SVGSVGElement[]): Promise<Icon[]> {
  const drawn: Icon[] = [];
  await Promise.all(icons.map(async (el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    const liveNodes = [el, ...el.querySelectorAll("*")];
    [clone, ...clone.querySelectorAll("*")].forEach((node, i) => bakeIconPaint(liveNodes[i], node));
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(box.width * SCALE));
    clone.setAttribute("height", String(box.height * SCALE));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      drawn.push({ image, x: box.left, y: box.top, w: box.width, h: box.height });
    } catch {
      /* An icon that cannot be read stays out, rather than blocking the picture. */
    } finally {
      URL.revokeObjectURL(url);
    }
  }));
  return drawn;
}

/* ---- the water's own CSS layers ---- */

/** Split on commas outside parentheses. */
function topLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

type Stop = { r: number; g: number; b: number; a: number; at: number | null };

function stopOf(text: string, length: number): Stop | null {
  const color = /rgba?\(([^)]+)\)/.exec(text);
  if (!color) return null;
  const [r, g, b, a = 1] = color[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const rest = text.slice(color.index + color[0].length).trim();
  let at: number | null = null;
  if (rest.endsWith("%")) at = parseFloat(rest) / 100;
  else if (rest.endsWith("px")) at = parseFloat(rest) / Math.max(1, length);
  return { r, g, b, a, at };
}

/** CSS stop positions filled in, and clear stops given their neighbour's colour (CSS mixes premultiplied). */
function settleStops(stops: Stop[]): Stop[] {
  if (!stops.length) return stops;
  if (stops[0].at === null) stops[0].at = 0;
  if (stops[stops.length - 1].at === null) stops[stops.length - 1].at = 1;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].at === null) continue;
    stops[i].at = Math.max(stops[i].at!, stops[i - 1].at ?? 0);
  }
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i].at !== null) continue;
    let j = i;
    while (stops[j].at === null) j++;
    const from = stops[i - 1].at!, to = stops[j].at!;
    for (let k = i; k < j; k++) stops[k].at = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return stops.map((s, i) => {
    if (s.a > 0) return s;
    const near = stops[i - 1]?.a ? stops[i - 1] : stops[i + 1]?.a ? stops[i + 1] : s;
    return { ...s, r: near.r, g: near.g, b: near.b };
  });
}

function fillStops(gradient: CanvasGradient, stops: Stop[]) {
  for (const s of settleStops(stops)) {
    gradient.addColorStop(Math.min(1, Math.max(0, s.at!)), `rgba(${s.r}, ${s.g}, ${s.b}, ${s.a})`);
  }
}

function length(text: string, of: number): number {
  return text.endsWith("%") ? (parseFloat(text) / 100) * of : parseFloat(text);
}

/** One `linear-gradient` / `radial-gradient` layer over `box`, as the browser computed it. */
function paintGradient(ctx: CanvasRenderingContext2D, layer: string, box: DOMRect) {
  const open = layer.indexOf("(");
  const kind = layer.slice(0, open).trim();
  const args = topLevel(layer.slice(open + 1, layer.lastIndexOf(")")));
  const { left: x, top: y, width: w, height: h } = box;
  if (kind === "linear-gradient") {
    let angle = Math.PI;
    if (args[0] && !args[0].includes("rgb")) {
      const head = args.shift()!;
      if (head.endsWith("deg")) angle = (parseFloat(head) * Math.PI) / 180;
      else if (head.endsWith("turn")) angle = parseFloat(head) * Math.PI * 2;
      else if (head.includes("top")) angle = 0;
      else if (head.includes("right")) angle = Math.PI / 2;
      else if (head.includes("left")) angle = Math.PI * 1.5;
    }
    const dx = Math.sin(angle), dy = -Math.cos(angle);
    const span = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = x + w / 2, cy = y + h / 2;
    const gradient = ctx.createLinearGradient(cx - (dx * span) / 2, cy - (dy * span) / 2, cx + (dx * span) / 2, cy + (dy * span) / 2);
    fillStops(gradient, args.map(a => stopOf(a, span)).filter((s): s is Stop => !!s));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    return;
  }
  if (kind !== "radial-gradient") return;
  let cx = x + w / 2, cy = y + h / 2;
  let size: string[] = [];
  let circle = false;
  if (args[0] && !args[0].includes("rgb")) {
    const head = args.shift()!;
    const [shape, at] = head.split(/\bat\b/).map(s => s.trim());
    if (at) {
      const [px, py = "50%"] = at.split(/\s+/);
      cx = x + length(px, w);
      cy = y + length(py, h);
    }
    circle = /\bcircle\b/.test(shape);
    size = shape.split(/\s+/).filter(word => word && word !== "ellipse" && word !== "circle");
  }
  let rx: number, ry: number;
  if (size.length >= 2 && !/-/.test(size[0])) {
    rx = length(size[0], w);
    ry = length(size[1], h);
  } else if (circle) {
    const near = Math.min(cx - x, x + w - cx, cy - y, y + h - cy);
    const far = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
    rx = ry = size[0] === "closest-side" ? near : far;
  } else {
    // farthest-corner, the CSS default: the ellipse keeps the farthest side's proportions
    const fx = Math.max(cx - x, x + w - cx), fy = Math.max(cy - y, y + h - cy);
    rx = fx * Math.SQRT2;
    ry = fy * Math.SQRT2;
  }
  if (rx <= 0 || ry <= 0) return;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  fillStops(gradient, args.map(a => stopOf(a, rx)).filter((s): s is Stop => !!s));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.fillStyle = gradient;
  ctx.fillRect((x - cx) / rx, (y - cy) / ry, w / rx, h / ry);
  ctx.restore();
}

function presence(el: Element): number {
  const box = el.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return 0;
  let opacity = 1;
  for (let node: Element | null = el; node && opacity > 0; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    const own = Number(style.opacity);
    if (Number.isFinite(own)) opacity *= own;
  }
  return opacity;
}

function paintLayers(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration, box: DOMRect) {
  if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(box.left, box.top, box.width, box.height);
  }
  if (style.backgroundImage !== "none") {
    for (const layer of topLevel(style.backgroundImage).reverse()) paintGradient(ctx, layer, box);
  }
}

/** Three box passes make a Gaussian of `sigma` px, on premultiplied pixels so clear edges stay clear. */
function gaussian(image: ImageData, sigma: number) {
  const { width: w, height: h, data } = image;
  const px = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    px[i] = data[i] * a; px[i + 1] = data[i + 1] * a; px[i + 2] = data[i + 2] * a; px[i + 3] = data[i + 3];
  }
  const r = Math.max(0, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const tmp = new Float32Array(px.length);
  const pass = (src: Float32Array, dst: Float32Array, along: number, across: number, step: number, stride: number) => {
    for (let j = 0; j < across; j++) {
      for (let c = 0; c < 4; c++) {
        const base = j * stride + c;
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[base + Math.min(along - 1, Math.max(0, k)) * step];
        for (let i = 0; i < along; i++) {
          dst[base + i * step] = sum / (2 * r + 1);
          sum += src[base + Math.min(along - 1, i + r + 1) * step] - src[base + Math.max(0, i - r) * step];
        }
      }
    }
  };
  for (let n = 0; n < 3; n++) {
    pass(px, tmp, w, h, 4, w * 4);
    pass(tmp, px, h, w, w * 4, 4);
  }
  for (let i = 0; i < data.length; i += 4) {
    const a = px[i + 3];
    const k = a > 0 ? 255 / a : 0;
    data[i] = px[i] * k; data[i + 1] = px[i + 1] * k; data[i + 2] = px[i + 2] * k; data[i + 3] = a;
  }
}

/** An element's background as the page paints it: its colour, then its layers bottom up, blurred if it is. */
function paintBackground(ctx: CanvasRenderingContext2D, el: Element) {
  const style = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const blur = /blur\(([\d.]+)px\)/.exec(style.filter);
  const sigma = blur ? Number(blur[1]) : 0;
  ctx.save();
  ctx.globalAlpha = presence(el);
  if (style.mixBlendMode && style.mixBlendMode !== "normal") ctx.globalCompositeOperation = style.mixBlendMode as GlobalCompositeOperation;
  if (sigma < 0.5) {
    paintLayers(ctx, style, box);
    ctx.restore();
    return;
  }
  // drawn small, where a few pixels of blur are many of the page's
  const step = Math.max(1, sigma / 4);
  const pad = sigma * 3;
  const plate = document.createElement("canvas");
  plate.width = Math.ceil((box.width + pad * 2) / step);
  plate.height = Math.ceil((box.height + pad * 2) / step);
  const p = plate.getContext("2d", { willReadFrequently: true })!;
  p.setTransform(1 / step, 0, 0, 1 / step, (pad - box.left) / step, (pad - box.top) / step);
  paintLayers(p, style, box);
  const image = p.getImageData(0, 0, plate.width, plate.height);
  gaussian(image, sigma / step);
  p.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(plate, box.left - pad, box.top - pad, plate.width * step, plate.height * step);
  ctx.restore();
}

/** The CSS filter a page lays over all of itself (brightness, contrast, saturate, sepia, hue-rotate), as the spec's matrices. */
function applyPageFilter(image: ImageData, filter: string) {
  const ops = [...filter.matchAll(/([a-z-]+)\(([-\d.]+)(deg|%)?\)/g)];
  if (!ops.length) return;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    for (const [, name, raw, unit] of ops) {
      const v = unit === "%" ? Number(raw) / 100 : Number(raw);
      if (name === "brightness") { r *= v; g *= v; b *= v; }
      else if (name === "contrast") { r = (r - 0.5) * v + 0.5; g = (g - 0.5) * v + 0.5; b = (b - 0.5) * v + 0.5; }
      else if (name === "saturate") {
        const s = v;
        [r, g, b] = [
          (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
          (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
          (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
        ];
      } else if (name === "sepia") {
        const k = 1 - Math.min(1, v);
        [r, g, b] = [
          (0.393 + 0.607 * k) * r + (0.769 - 0.769 * k) * g + (0.189 - 0.189 * k) * b,
          (0.349 - 0.349 * k) * r + (0.686 + 0.314 * k) * g + (0.168 - 0.168 * k) * b,
          (0.272 - 0.272 * k) * r + (0.534 - 0.534 * k) * g + (0.131 + 0.869 * k) * b,
        ];
      } else if (name === "hue-rotate") {
        const a = (v * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        [r, g, b] = [
          (0.213 + c * 0.787 - s * 0.213) * r + (0.715 - c * 0.715 - s * 0.715) * g + (0.072 - c * 0.072 + s * 0.928) * b,
          (0.213 - c * 0.213 + s * 0.143) * r + (0.715 + c * 0.285 + s * 0.140) * g + (0.072 - c * 0.072 - s * 0.283) * b,
          (0.213 - c * 0.213 - s * 0.787) * r + (0.715 - c * 0.715 + s * 0.715) * g + (0.072 + c * 0.928 + s * 0.072) * b,
        ];
      }
      r = Math.min(1, Math.max(0, r)); g = Math.min(1, Math.max(0, g)); b = Math.min(1, Math.max(0, b));
    }
    data[i] = r * 255; data[i + 1] = g * 255; data[i + 2] = b * 255;
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Draws the page's scenes and washes again at BOOST × their screen density,
 * with every clock held, and returns the way back. A scene's screen-space
 * grain is held to its screen size through uCaptureScale.
 */
async function sharpen(canvases: HTMLCanvasElement[]): Promise<() => void> {
  const release = freezeCapture();
  const { _roots } = await import("@react-three/fiber");
  const undo: (() => void)[] = [];
  const stores = canvases.map(canvas => _roots.get(canvas)?.store).filter(store => !!store);
  for (const store of stores) {
    const state = store.getState();
    const was = state.viewport.dpr;
    const grain: { value: number }[] = [];
    state.scene.traverse((object) => {
      const material = (object as { material?: unknown }).material;
      for (const one of Array.isArray(material) ? material : material ? [material] : []) {
        const uniform = (one as { uniforms?: Record<string, { value: number }> }).uniforms?.uCaptureScale;
        if (uniform && !grain.includes(uniform)) grain.push(uniform);
      }
    });
    grain.forEach(uniform => { uniform.value = BOOST; });
    state.setDpr(was * BOOST);
    state.invalidate();
    undo.push(() => {
      grain.forEach(uniform => { uniform.value = 1; });
      state.setDpr(was);
      state.invalidate();
    });
  }
  setCaptureBoost(BOOST);
  undo.push(() => setCaptureBoost(1));
  // the scenes resize their passes after React commits; let a few frames land at the new size
  for (let i = 0; i < 4; i++) {
    stores.forEach(store => store.getState().invalidate());
    await nextFrame();
  }
  return () => {
    undo.reverse().forEach(step => step());
    release();
  };
}

function save(canvas: HTMLCanvasElement): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("couldn't capture")); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nijimu-${canvas.width}x${canvas.height}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve({ width: canvas.width, height: canvas.height });
    }, "image/png");
  });
}

/**
 * Draw the current page at 2× and download it. Pictures are copied immediately,
 * before another frame can clear a WebGL buffer.
 */
export async function capturePage(request: CaptureRequest): Promise<CaptureResult> {
  const cssW = Math.max(1, Math.round(window.innerWidth));
  const cssH = Math.max(1, Math.round(window.innerHeight));
  const pictures = hittingCanvases(() => [...document.querySelectorAll<HTMLCanvasElement>("canvas")]
    .filter(canvas => shown(canvas) && !isChrome(canvas) && !canvas.closest(CHROME) && exposed(canvas)));
  // A page's own CSS ground, the lights laid over or under its pictures, and a filter over all of it.
  const skies = [...document.querySelectorAll("[data-capture-backdrop]")].filter(el => presence(el) > 0).sort(byPaint);
  const veils = [...document.querySelectorAll("[data-capture-veil]")].filter(el => presence(el) > 0);
  const filters = [...document.querySelectorAll("[data-capture-filter]")]
    .filter(el => presence(el) > 0).map(el => getComputedStyle(el).filter).filter(f => f && f !== "none");
  const layers: Element[] = [...pictures, ...veils].sort(byPaint);
  const chrome: Chrome = request.includeUi ? readChrome() : { lines: [], icons: [], rules: [], plates: [], bars: [], knobs: [] };

  const page = document.createElement("canvas");
  page.width = cssW * SCALE;
  page.height = cssH * SCALE;
  const ctx = page.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("couldn't capture");

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cardLight(cssW, cssH, placeOf(cssW, cssH, pictures)), 0, 0, cssW, cssH);
  for (const sky of skies) paintBackground(ctx, sky);

  const ground = ctx.getImageData(0, 0, page.width, page.height);
  applyWallGrain(ground, SCALE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(ground, 0, 0);

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const restore = await sharpen(pictures);
  try {
    for (const layer of layers) {
      if (!(layer instanceof HTMLCanvasElement)) { paintBackground(ctx, layer); continue; }
      const box = layer.getBoundingClientRect();
      drawPicture(ctx, layer, box.left, box.top, box.width, box.height);
    }
  } finally {
    restore();
  }
  for (const image of document.querySelectorAll<HTMLImageElement>("img")) {
    if (!shown(image) || isChrome(image) || image.closest(CHROME)) continue;
    const box = image.getBoundingClientRect();
    drawPicture(ctx, image, box.left, box.top, box.width, box.height);
  }

  const picture = ctx.getImageData(0, 0, page.width, page.height);
  for (const filter of filters) applyPageFilter(picture, filter);
  applyCardFilmGrain(picture, SCALE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(picture, 0, 0);

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  for (const plate of chrome.plates) paintPlate(ctx, plate);
  for (const bar of chrome.bars) {
    ctx.globalAlpha = bar.alpha;
    ctx.fillStyle = bar.color;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  }
  for (const knob of chrome.knobs) paintPlate(ctx, knob);
  ctx.globalAlpha = 1;
  for (const rule of chrome.rules) {
    ctx.strokeStyle = rule.color;
    ctx.lineWidth = rule.weight;
    ctx.beginPath();
    ctx.moveTo(rule.x, rule.y);
    ctx.lineTo(rule.x + rule.w, rule.y);
    ctx.stroke();
  }
  const icons = await iconBitmaps(chrome.icons);
  for (const icon of icons) drawPicture(ctx, icon.image, icon.x, icon.y, icon.w, icon.h);
  for (const line of chrome.lines) {
    ctx.globalCompositeOperation = line.blend;
    ctx.globalAlpha = line.alpha;
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.textAlign = line.align;
    ctx.textBaseline = line.baseline ?? "top";
    ctx.fillText(line.text, line.x, line.y);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  return save(page);
}
